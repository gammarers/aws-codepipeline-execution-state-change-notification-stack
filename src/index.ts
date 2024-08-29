import * as crypto from 'crypto';
import { CodePipelineExecutionStateChangeDetectionEventRule } from '@gammarers/aws-codepipeline-execution-state-change-detection-event-rule';
import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';

export interface TargetResourceProperty {
  readonly tagKey: string;
  readonly tagValues: string[];
}

export interface NotificationsProperty {
  readonly emails?: string[];
}
export interface CodePipelineExecutionStateChangeNotificationStackProps extends cdk.StackProps {
  readonly targetResource: TargetResourceProperty;
  readonly enabled?: boolean;
  readonly notifications: NotificationsProperty;
}

export class CodePipelineExecutionStateChangeNotificationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CodePipelineExecutionStateChangeNotificationStackProps) {
    super(scope, id, props);

    const account = cdk.Stack.of(this).account;

    // 👇 Create random 8 length string
    const random: string = crypto.createHash('shake256', { outputLength: 4 })
      .update(cdk.Names.uniqueId(this))
      .digest('hex');

    // 👇 SNS Topic for notifications
    const topic: sns.Topic = new sns.Topic(this, 'CodePipelineNotificationTopic', {
      topicName: `codepipeline-execution-state-change-notification-${random}-topic`,
      displayName: 'CodePipeline Execution state change Notification Topic',
    });

    // Subscribe an email endpoint to the topic
    for (const email of props.notifications.emails ?? []) {
      topic.addSubscription(new subscriptions.EmailSubscription(email));
    }

    // Subscribe a HTTP endpoint (Slack Webhook) to the topic
    //topic.addSubscription(new subs.UrlSubscription('https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'));

    const initPipelineStateEmojisDefinition: sfn.Pass = new sfn.Pass(this, 'InitPipelineStateEmojiDefinition', {
      result: sfn.Result.fromObject([
        { name: 'STARTED', emoji: '🥳' },
        { name: 'SUCCEEDED', emoji: '🤩' },
        { name: 'RESUMED', emoji: '🤔' },
        { name: 'FAILED', emoji: '😫' },
        { name: 'STOPPING', emoji: '😮' },
        { name: 'STOPPED', emoji: '😌' },
        { name: 'SUPERSEDED', emoji: '🧐' },
      ]),
      resultPath: '$.Definition.StateEmojis',
    });

    const succeed: sfn.Succeed = new sfn.Succeed(this, 'Succeed');

    // describe pipeline
    const getPipeline = new tasks.CallAwsService(this, 'GetPipeline', {
      iamResources: [`arn:aws:codepipeline:*:${account}:*`],
      service: 'codepipeline',
      action: 'getPipeline',
      parameters: {
        Name: sfn.JsonPath.stringAt('$.event.detail.pipeline'),
      },
      resultPath: '$.Result.Pipeline',
      resultSelector: {
        Arn: sfn.JsonPath.stringAt('$.Metadata.PipelineArn'),
      },
    });
    initPipelineStateEmojisDefinition.next(getPipeline);

    // 👇 Get Resources from resource arn list
    const getResourceTagMappingList: tasks.CallAwsService = new tasks.CallAwsService(this, 'GetResourceTagMappingList', {
      service: 'resourcegroupstaggingapi',
      action: 'getResources',
      parameters: {
        // ResourceARNList: sfn.JsonPath.listAt('$.resources'),
        ResourceTypeFilters: ['codepipeline:pipeline'], // ResourceTypeFilters is not allowed when providing a ResourceARNList
        TagFilters: [
          {
            Key: sfn.JsonPath.stringAt('$.params.tagKey'),
            Values: sfn.JsonPath.stringAt('$.params.tagValues'),
          },
        ], // TagFilters is not allowed when providing a ResourceARNList
      },
      iamAction: 'tag:GetResources',
      iamResources: ['*'],
      resultPath: '$.Result.GetMatchTagResource',
      resultSelector: {
        Arns: sfn.JsonPath.stringAt('$..ResourceTagMappingList[*].ResourceARN'),
      },
    });
    // getTags.addCatch()
    getPipeline.next(getResourceTagMappingList);

    // 👇 Is in
    const checkTagFilterArnsContain: sfn.Pass = new sfn.Pass(this, 'CheckTagFilterArnsContain', {
      parameters: {
        Is: sfn.JsonPath.arrayContains(sfn.JsonPath.stringAt('$.Result.GetMatchTagResource.Arns'), sfn.JsonPath.stringAt('$.Result.Pipeline.Arn')),
      },
      resultPath: '$.Result.TagFilterArnsContain',
    });

    getResourceTagMappingList.next(checkTagFilterArnsContain);

    // 👇 Create pipeline URL
    const generatePipelineUrl = new sfn.Pass(this, 'GeneratePipelineUrl', {
      resultPath: '$.Generate.PipelineUrl',
      parameters: {
        Value: sfn.JsonPath.format('https://{}.console.aws.amazon.com/codesuite/codepipeline/pipelines/{}/view?region={}',
          sfn.JsonPath.stringAt('$.event.region'),
          sfn.JsonPath.stringAt('$.event.detail.pipeline'),
          sfn.JsonPath.stringAt('$.event.region'),
        ),
      },
    });

    const generateTopicSubject = new sfn.Pass(this, 'GenerateTopicSubject', {
      resultPath: '$.Generate.Topic.Subject',
      parameters: {
        Value: sfn.JsonPath.format('{} [{}] AWS CodePipeline Pipeline Execution State Notification [{}][{}]',
          sfn.JsonPath.arrayGetItem(sfn.JsonPath.stringAt('$.Definition.StateEmojis[?(@.name == $.event.detail.state)].emoji'), 0),
          sfn.JsonPath.stringAt('$.event.detail.state'),
          sfn.JsonPath.stringAt('$.event.account'),
          sfn.JsonPath.stringAt('$.event.region'),
        ),
      },
    });

    generatePipelineUrl.next(generateTopicSubject);

    // 👇 Make send default & email message
    const generateTopicMessage: sfn.Pass = new sfn.Pass(this, 'GeneratedPipelineMessage', {
      resultPath: '$.Generate.Topic.Message',
      parameters: {
        Value: sfn.JsonPath.format('Account : {}\nRegion : {}\nPipeline : {}\nState : {}\nTime : {}\nURL : {}\n',
          sfn.JsonPath.stringAt('$.event.account'),
          sfn.JsonPath.stringAt('$.event.region'),
          sfn.JsonPath.stringAt('$.event.detail.pipeline'),
          sfn.JsonPath.stringAt('$.event.detail.state'),
          sfn.JsonPath.stringAt('$.event.time'),
          sfn.JsonPath.stringAt('$.Generate.PipelineUrl.Value'),
        ),
      },
    });

    generateTopicSubject.next(generateTopicMessage);


    // 👇 Choice state for message
    const checkPipelineStateMatch: sfn.Choice = new sfn.Choice(this, 'CheckPipelineStateMatch')
      .when(sfn.Condition.stringEquals('$.event.detail.state', 'STARTED'), generatePipelineUrl)
      .when(sfn.Condition.stringEquals('$.event.detail.state', 'SUCCEEDED'), generatePipelineUrl)
      .when(sfn.Condition.stringEquals('$.event.detail.state', 'RESUMED'), generatePipelineUrl)
      .when(sfn.Condition.stringEquals('$.event.detail.state', 'FAILED'), generatePipelineUrl)
      .when(sfn.Condition.stringEquals('$.event.detail.state', 'STOPPING'), generatePipelineUrl)
      .when(sfn.Condition.stringEquals('$.event.detail.state', 'STOPPED'), generatePipelineUrl)
      .when(sfn.Condition.stringEquals('$.event.detail.state', 'SUPERSEDED'), generatePipelineUrl)
      .otherwise(new sfn.Pass(this, 'NoMatchValue'));

    const checkFoundTagMatch = new sfn.Choice(this, 'CheckFoundTagMatch')
      .when(sfn.Condition.booleanEquals('$.Result.TagFilterArnsContain.Is', true), checkPipelineStateMatch)
      .otherwise(new sfn.Pass(this, 'NoMatchPipelineState'));

    checkTagFilterArnsContain.next(checkFoundTagMatch);

    // 👇 Send notification task
    const sendNotification: tasks.SnsPublish = new tasks.SnsPublish(this, 'SendNotification', {
      topic: topic,
      subject: sfn.JsonPath.stringAt('$.Generate.Topic.Subject.Value'),
      message: sfn.TaskInput.fromJsonPathAt('$.Generate.Topic.Message.Value'),
      resultPath: '$.snsResult',
    });

    generateTopicMessage.next(sendNotification);

    sendNotification.next(succeed);

    // 👇 Create State Machine
    const stateMachine: sfn.StateMachine = new sfn.StateMachine(this, 'StateMachine', {
      stateMachineName: `codepipeline-event-notification-${random}-state-machine`,
      timeout: cdk.Duration.minutes(5),
      definitionBody: sfn.DefinitionBody.fromChainable(initPipelineStateEmojisDefinition),
    });

    // 👇 Create EventBridge Rule
    new CodePipelineExecutionStateChangeDetectionEventRule(this, 'Rule', {
      ruleName: `codepipeline-event-catch-${random}-rule`,
      targets: [
        new targets.SfnStateMachine(stateMachine, {
          input: events.RuleTargetInput.fromObject({
            event: events.EventField.fromPath('$'),
            params: {
              tagKey: props.targetResource.tagKey,
              tagValues: props.targetResource.tagValues,
            },
          }),
        }),
      ],
    });
  }
}
