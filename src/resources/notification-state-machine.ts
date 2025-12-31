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

        const initDefinition: sfn.Pass = new sfn.Pass(scope, 'InitDefinition', {
          resultPath: '$.Definition',
          parameters: {
            StateEmojis: [
              { name: 'STARTED', emoji: '🥳' },
              { name: 'SUCCEEDED', emoji: '🤩' },
              { name: 'RESUMED', emoji: '🤔' },
              { name: 'FAILED', emoji: '😫' },
              { name: 'STOPPING', emoji: '😮' },
              { name: 'STOPPED', emoji: '😌' },
              { name: 'SUPERSEDED', emoji: '🧐' },
            ],
            StateColors: [
              { name: 'STARTED', color: '#00bfff' },
              { name: 'SUCCEEDED', color: '#36a64f' },
              { name: 'RESUMED', color: '#87cefa' },
              { name: 'FAILED', color: '#ff0000' },
              { name: 'STOPPING', color: '#ffff00' },
              { name: 'STOPPED', color: '#ffd700' },
              { name: 'SUPERSEDED', color: '#ffa500' },
            ],
          },
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
        initDefinition.next(getPipeline);

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

        const generateMessage = new sfn.Pass(scope, 'GenerateMessage', {
          resultPath: '$.Generate.Message',
          parameters: {
            Subject: sfn.JsonPath.format('{} [{}] AWS CodePipeline Pipeline Execution State Notification [{}][{}]',
              sfn.JsonPath.arrayGetItem(sfn.JsonPath.stringAt('$.Definition.StateEmojis[?(@.name == $.event.detail.state)].emoji'), 0),
              sfn.JsonPath.stringAt('$.event.detail.state'),
              sfn.JsonPath.stringAt('$.event.account'),
              sfn.JsonPath.stringAt('$.event.region'),
            ),
            TextBody: sfn.JsonPath.format('Account : {}\nRegion : {}\nPipeline : {}\nState : {}\nTime : {}\nURL : {}\n',
              sfn.JsonPath.stringAt('$.event.account'),
              sfn.JsonPath.stringAt('$.event.region'),
              sfn.JsonPath.stringAt('$.event.detail.pipeline'),
              sfn.JsonPath.stringAt('$.event.detail.state'),
              sfn.JsonPath.stringAt('$.event.time'),
              sfn.JsonPath.stringAt('$.Generate.PipelineUrl.Value'),
            ),
            SlackJsonBody: {
              attachments: [
                {
                  color: sfn.JsonPath.arrayGetItem(sfn.JsonPath.stringAt('$.Definition.StateColors[?(@.name == $.event.detail.state)].color'), 0),
                  // pretext: sfn.JsonPath.format('😴 Successfully stopped the automatically running RDS {} {}.',
                  pretext: sfn.JsonPath.format('{} Pipeline {} state changed to {}',
                    sfn.JsonPath.arrayGetItem(sfn.JsonPath.stringAt('$.Definition.StateEmojis[?(@.name == $.event.detail.state)].emoji'), 0),
                    sfn.JsonPath.stringAt('$.event.detail.pipeline'),
                    sfn.JsonPath.stringAt('$.event.detail.state'),
                  ),
                  fields: [
                    {
                      title: 'Account',
                      value: sfn.JsonPath.stringAt('$.event.account'),
                      short: true,
                    },
                    {
                      title: 'Region',
                      value: sfn.JsonPath.stringAt('$.event.region'),
                      short: true,
                    },
                    {
                      title: 'Pipeline',
                      value: sfn.JsonPath.stringAt('$.event.detail.pipeline'),
                      short: true,
                    },
                    {
                      title: 'State',
                      value: sfn.JsonPath.stringAt('$.event.detail.state'),
                      short: true,
                    },
                    {
                      title: 'Time',
                      value: sfn.JsonPath.stringAt('$.event.time'),
                      short: true,
                    },
                  ],
                },
              ],
            },
          },
        });
        generatePipelineUrl.next(generateMessage);

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
          subject: sfn.JsonPath.stringAt('$.Generate.Message.Subject'),
          message: sfn.TaskInput.fromObject({
            default: sfn.JsonPath.stringAt('$.Generate.Message.TextBody'),
            email: sfn.JsonPath.stringAt('$.Generate.Message.TextBody'),
            lambda: sfn.JsonPath.jsonToString(sfn.JsonPath.objectAt('$.Generate.Message.SlackJsonBody')),
          }),
          messagePerSubscriptionType: true,
          resultPath: '$.snsResult',
        });

        generateMessage.next(sendNotification);

        sendNotification.next(succeed);
        return sfn.DefinitionBody.fromChainable(initDefinition);

      })(),
    });
  }
}