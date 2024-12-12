import { Stack } from 'aws-cdk-lib';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';

export interface NotificationStateMachineProps extends sfn.StateMachineProps {
  notificationTopic: sns.ITopic;
}

export class NotificationStateMachine extends sfn.StateMachine {
  constructor(scope: Construct, id: string, props: NotificationStateMachineProps) {
    super(scope, id, {
      ...props,
      definitionBody: (() => {

        // 👇 Get Account
        const account = Stack.of(scope).account;

        const initPipelineStateEmojisDefinition: sfn.Pass = new sfn.Pass(scope, 'InitPipelineStateEmojiDefinition', {
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

        const succeed: sfn.Succeed = new sfn.Succeed(scope, 'Succeed');

        // describe pipeline
        const getPipeline = new tasks.CallAwsService(scope, 'GetPipeline', {
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
        const getResourceTagMappingList: tasks.CallAwsService = new tasks.CallAwsService(scope, 'GetResourceTagMappingList', {
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
        const checkTagFilterArnsContain: sfn.Pass = new sfn.Pass(scope, 'CheckTagFilterArnsContain', {
          parameters: {
            Is: sfn.JsonPath.arrayContains(sfn.JsonPath.stringAt('$.Result.GetMatchTagResource.Arns'), sfn.JsonPath.stringAt('$.Result.Pipeline.Arn')),
          },
          resultPath: '$.Result.TagFilterArnsContain',
        });

        getResourceTagMappingList.next(checkTagFilterArnsContain);

        // 👇 Create pipeline URL
        const generatePipelineUrl = new sfn.Pass(scope, 'GeneratePipelineUrl', {
          resultPath: '$.Generate.PipelineUrl',
          parameters: {
            Value: sfn.JsonPath.format('https://{}.console.aws.amazon.com/codesuite/codepipeline/pipelines/{}/view?region={}',
              sfn.JsonPath.stringAt('$.event.region'),
              sfn.JsonPath.stringAt('$.event.detail.pipeline'),
              sfn.JsonPath.stringAt('$.event.region'),
            ),
          },
        });

        const generateTopicSubject = new sfn.Pass(scope, 'GenerateTopicSubject', {
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
        const generateTopicTextMessage: sfn.Pass = new sfn.Pass(scope, 'GeneratedPipelineMessage', {
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

        generateTopicSubject.next(generateTopicTextMessage);

        // 👇 Choice state for message
        const checkPipelineStateMatch: sfn.Choice = new sfn.Choice(scope, 'CheckPipelineStateMatch')
          .when(
            sfn.Condition.or(
              sfn.Condition.stringEquals('$.event.detail.state', 'STARTED'),
              sfn.Condition.stringEquals('$.event.detail.state', 'SUCCEEDED'),
              sfn.Condition.stringEquals('$.event.detail.state', 'RESUMED'),
              sfn.Condition.stringEquals('$.event.detail.state', 'FAILED'),
              sfn.Condition.stringEquals('$.event.detail.state', 'STOPPING'),
              sfn.Condition.stringEquals('$.event.detail.state', 'STOPPED'),
              sfn.Condition.stringEquals('$.event.detail.state', 'SUPERSEDED'),
            ),
            generatePipelineUrl,
          )
          .otherwise(new sfn.Pass(scope, 'UnMatchStatus'));

        const checkFoundTagMatch = new sfn.Choice(scope, 'CheckFoundTagMatch')
          .when(sfn.Condition.booleanEquals('$.Result.TagFilterArnsContain.Is', true), checkPipelineStateMatch)
          .otherwise(new sfn.Pass(scope, 'UnMatchPipelineTagFilter'));

        checkTagFilterArnsContain.next(checkFoundTagMatch);

        // 👇 Send notification task
        const sendNotification: tasks.SnsPublish = new tasks.SnsPublish(scope, 'SendNotification', {
          topic: props.notificationTopic,
          subject: sfn.JsonPath.stringAt('$.Generate.Topic.Subject.Value'),
          message: sfn.TaskInput.fromJsonPathAt('$.Generate.Topic.Message.Value'),
          resultPath: '$.snsResult',
        });

        generateTopicTextMessage.next(sendNotification);

        sendNotification.next(succeed);
        return sfn.DefinitionBody.fromChainable(initPipelineStateEmojisDefinition);

      })(),
    });
  }
}