import * as crypto from 'crypto';
import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';

export interface NotificationsProperty {
  readonly emails?: string[];
}
export interface CodePipelineEventNotificationStackProps extends cdk.StackProps {
  readonly notifications: NotificationsProperty;
}

export class CodePipelineEventNotificationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CodePipelineEventNotificationStackProps) {
    super(scope, id, props);

    const random: string = crypto.createHash('shake256', { outputLength: 4 })
      .update(cdk.Names.uniqueId(this))
      .digest('hex');

    // SNS Topic for notifications
    const topic: sns.Topic = new sns.Topic(this, 'CodePipelineNotificationTopic', {
      topicName: `code-pipeline-event-notification-${random}-topic`,
      displayName: 'CodePipeline Event Notification Topic',
    });

    // Subscribe an email endpoint to the topic
    for (const email of props.notifications.emails ?? []) {
      topic.addSubscription(new subscriptions.EmailSubscription(email));
    }

    // Subscribe a HTTP endpoint (Slack Webhook) to the topic
    //topic.addSubscription(new subs.UrlSubscription('https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'));

    const succeed: sfn.Succeed = new sfn.Succeed(this, 'Succeed');

    // Step Functions Tasks
    const getResourceTagMappingList: tasks.CallAwsService = new tasks.CallAwsService(this, 'GetResourceTagMappingList', {
      service: 'resourcegroupstaggingapi',
      action: 'getResources',
      parameters: {
        ResourceARNList: sfn.JsonPath.listAt('$.resources'),
        //        TagFilters: [
        //          {
        //            Key: 'DeployNotification',
        //            Values: ['YES'],
        //          },
        //        ],
        // ResourceTypeFilters: ['codepipeline:pipeline'], // ResourceTypeFilters is not allowed when providing a ResourceARNList
      },
      iamAction: 'tag:GetResources',
      iamResources: ['*'],
      //resultPath: '$.tagsResult',
      resultPath: '$.Result.GetResource',
      //      resultSelector: {
      //        'Tags.$': '$.ResourceTagMappingList[0].Tags',
      //      },
    });
    //getTags.addCatch()

    const findTagVluesPass: sfn.Pass = new sfn.Pass(this, 'FindTagVlues', {
      parameters: {
        //'Find.$': "States.JsonToString($.tagsResult.Tags[?(@.Key == 'DeployNotification')])",
        //Found: "States.JsonToString($.tagsResult.Tags[?(@.Key == 'DeployNotification')])",
        Found: sfn.JsonPath.stringAt("$.Result.GetTags.Tags[?(@.Key == 'DeployNotification')].Value"),
        //Find: sfn.JsonPath.stringToJson('States.JsonToString($.tagsResult.Tags[?(@.Key == "DeployNotification")])'),
        //Find: sfn.JsonPath.jsonToString("$.tagsResult.Tags[?(@.Key == 'DeployNotification')]"),
      },
      resultPath: '$.Result.FindTagValues',
    });

    const checkResouceTagsExist: sfn.Choice = new sfn.Choice(this, 'CheckResouceTagsExist')
      .when(sfn.Condition.isPresent('$.Result.GetResource.ResourceTagMappingList[0].Tags'),
        new sfn.Pass(this, 'TagsExist', {
          parameters: {
            Tags: sfn.JsonPath.stringAt('$.Result.GetResource.ResourceTagMappingList[0].Tags'),
          },
          resultPath: '$.Result.GetTags',
        }).next(findTagVluesPass))
      .otherwise(new sfn.Pass(this, 'NoTagsFound', {
        comment: 'This Reouces is not set Tags',
      }));

    getResourceTagMappingList.next(checkResouceTagsExist);
    //    const checkIfFoundState = new sfn.Choice(this, 'CheckFindTag')
    //      .when(sfn.Condition.isPresent('$.findTag.Found'), new sfn.Succeed(this, 'BBBSucceed'))
    //      .otherwise(new sfn.Pass(this, 'TagNotFound'));

    //const checkArrayContains = sfn.Condition.booleanEquals('$.arrayContainsResult', true);

    // 配列に値が含まれているかどうかを計算するPassステート
    const checkArrayContainsPass: sfn.Pass = new sfn.Pass(this, 'CheckArrayContains', {
      parameters: {
        Is: sfn.JsonPath.arrayContains(sfn.JsonPath.stringAt('$.Result.FindTagValues.Found'), 'YES'),
      },
      resultPath: '$.Result.ContainTag',
    });

    findTagVluesPass.next(checkArrayContainsPass);

    const messageStatusIcons = {
      started: '🥳',
      succeeded: '🤩',
      resumed: '🤔',
      failed: '😫',
      stopping: '😮',
      stopped: '😌',
      superseded: '🧐',
    };

    const createPreparePipelineMessageSubject = ((statusIcon: string) => {
      return sfn.JsonPath.format(`${statusIcon} [{}] {} [{}][{}]`,
        sfn.JsonPath.stringAt('$.detail.state'),
        sfn.JsonPath.stringAt('$.detail.pipeline'),
        sfn.JsonPath.stringAt('$.account'),
        sfn.JsonPath.stringAt('$.region'),
      );
    });

    const prepareStartedPipelineMessage: sfn.Pass = new sfn.Pass(this, 'PrepareStartedPipelineMessage', {
      parameters: {
        Subject: createPreparePipelineMessageSubject(messageStatusIcons.started),
        Message: sfn.JsonPath.format('Account : {}\nRegion : {}\nPipeline :  {}\nState : {}',
          sfn.JsonPath.stringAt('$.account'),
          sfn.JsonPath.stringAt('$.region'),
          sfn.JsonPath.stringAt('$.detail.pipeline'),
          sfn.JsonPath.stringAt('$.detail.state'),
        ),
      },
    });

    const prepareSucceededdPipelineMessage: sfn.Pass = new sfn.Pass(this, 'PrepareSucceededdPipelineMessage', {
      parameters: {
        Subject: createPreparePipelineMessageSubject(messageStatusIcons.succeeded),
        Message: sfn.JsonPath.format('Account : {}\nRegion : {}\nPipeline :  {}\nState : {}',
          sfn.JsonPath.stringAt('$.account'),
          sfn.JsonPath.stringAt('$.region'),
          sfn.JsonPath.stringAt('$.detail.pipeline'),
          sfn.JsonPath.stringAt('$.detail.state'),
        ),
      },
    });

    const prepareResumedPipelineMessage: sfn.Pass = new sfn.Pass(this, 'PrepareResumedPipelineMessage', {
      parameters: {
        Subject: createPreparePipelineMessageSubject(messageStatusIcons.resumed),
        Message: sfn.JsonPath.format('Account : {}\nRegion : {}\nPipeline :  {}\nState : {}',
          sfn.JsonPath.stringAt('$.account'),
          sfn.JsonPath.stringAt('$.region'),
          sfn.JsonPath.stringAt('$.detail.pipeline'),
          sfn.JsonPath.stringAt('$.detail.state'),
        ),
      },
    });

    const prepareFailedPipelineMessage: sfn.Pass = new sfn.Pass(this, 'PrepareFailedPipelineMessage', {
      parameters: {
        Subject: createPreparePipelineMessageSubject(messageStatusIcons.failed),
        Message: sfn.JsonPath.format('Account : {}\nRegion : {}\nPipeline :  {}\nState : {}',
          sfn.JsonPath.stringAt('$.account'),
          sfn.JsonPath.stringAt('$.region'),
          sfn.JsonPath.stringAt('$.detail.pipeline'),
          sfn.JsonPath.stringAt('$.detail.state'),
        ),
      },
    });

    const prepareStoppingPipelineMessage: sfn.Pass = new sfn.Pass(this, 'PrepareStoppingPipelineMessage', {
      parameters: {
        Subject: createPreparePipelineMessageSubject(messageStatusIcons.stopping),
        Message: sfn.JsonPath.format('Account : {}\nRegion : {}\nPipeline :  {}\nState : {}',
          sfn.JsonPath.stringAt('$.account'),
          sfn.JsonPath.stringAt('$.region'),
          sfn.JsonPath.stringAt('$.detail.pipeline'),
          sfn.JsonPath.stringAt('$.detail.state'),
        ),
      },
    });

    const prepareStoppedPipelineMessage: sfn.Pass = new sfn.Pass(this, 'PrepareStoppedPipelineMessage', {
      parameters: {
        Subject: createPreparePipelineMessageSubject(messageStatusIcons.stopped),
        Message: sfn.JsonPath.format('Account : {}\nRegion : {}\nPipeline :  {}\nState : {}',
          sfn.JsonPath.stringAt('$.account'),
          sfn.JsonPath.stringAt('$.region'),
          sfn.JsonPath.stringAt('$.detail.pipeline'),
          sfn.JsonPath.stringAt('$.detail.state'),
        ),
      },
    });

    const prepareSupersededPipelineMessage: sfn.Pass = new sfn.Pass(this, 'PrepareSupersededPipelineMessage', {
      parameters: {
        Subject: createPreparePipelineMessageSubject(messageStatusIcons.superseded),
        Message: sfn.JsonPath.format('Account : {}\nRegion : {}\nPipeline :  {}\nState : {}',
          sfn.JsonPath.stringAt('$.account'),
          sfn.JsonPath.stringAt('$.region'),
          sfn.JsonPath.stringAt('$.detail.pipeline'),
          sfn.JsonPath.stringAt('$.detail.state'),
        ),
      },
    });

    const checkPipelineStateMatch: sfn.Choice = new sfn.Choice(this, 'CheckPipelineStateMatch')
      .when(sfn.Condition.stringEquals('$.detail.state', 'STARTED'), prepareStartedPipelineMessage)
      .when(sfn.Condition.stringEquals('$.detail.state', 'SUCCEEDED'), prepareSucceededdPipelineMessage)
      .when(sfn.Condition.stringEquals('$.detail.state', 'RESUMED'), prepareResumedPipelineMessage)
      .when(sfn.Condition.stringEquals('$.detail.state', 'FAILED'), prepareFailedPipelineMessage)
      .when(sfn.Condition.stringEquals('$.detail.state', 'STOPPING'), prepareStoppingPipelineMessage)
      .when(sfn.Condition.stringEquals('$.detail.state', 'STOPPED'), prepareStoppedPipelineMessage)
      .when(sfn.Condition.stringEquals('$.detail.state', 'SUPERSEDED'), prepareSupersededPipelineMessage)
      .otherwise(new sfn.Pass(this, 'NoMatchValue'));

    const checkFoundTagMatch = new sfn.Choice(this, 'CheckFoundTagMatch')
      .when(sfn.Condition.booleanEquals('$.Result.ContainTag.Is', true), checkPipelineStateMatch)
      .otherwise(new sfn.Pass(this, 'NoMatchPipelineState'));

    checkArrayContainsPass.next(checkFoundTagMatch);

    const sendNotification: tasks.SnsPublish = new tasks.SnsPublish(this, 'SendNotification', {
      topic: topic,
      subject: sfn.JsonPath.stringAt('$.Subject'),
      message: sfn.TaskInput.fromJsonPathAt('$.Message'),
      resultPath: '$.snsResult',
    });

    prepareStartedPipelineMessage.next(sendNotification);
    prepareSucceededdPipelineMessage.next(sendNotification);
    prepareResumedPipelineMessage.next(sendNotification);
    prepareFailedPipelineMessage.next(sendNotification);
    prepareStoppingPipelineMessage.next(sendNotification);
    prepareStoppedPipelineMessage.next(sendNotification);
    prepareSupersededPipelineMessage.next(sendNotification);

    sendNotification.next(succeed);

    // Step Functions State Machine
    const stateMachine: sfn.StateMachine = new sfn.StateMachine(this, 'StateMachine', {
      stateMachineName: `codepipeline-event-notification-${random}-state-machine`,
      timeout: cdk.Duration.minutes(5),
      definition: getResourceTagMappingList,
    });

    // EventBridge Rule
    new events.Rule(this, 'Rule', {
      ruleName: `codepipeline-event-catch-${random}-rule`,
      eventPattern: {
        source: ['aws.codepipeline'],
        detailType: ['CodePipeline Pipeline Execution State Change'],
      },
      targets: [new targets.SfnStateMachine(stateMachine)],
    });
  }
}
