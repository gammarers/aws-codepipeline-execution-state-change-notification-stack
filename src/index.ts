import { CodePipelinePipelineExecutionStateChangeDetectionEventRule } from '@gammarers/aws-codesuite-state-change-detection-event-rules';
import { ResourceAutoNaming, ResourceDefaultNaming, ResourceNaming, ResourceNamingType as CodePipelineExecutionStateChangeNotificationStackResourceNamingType } from '@gammarers/aws-resource-naming';
import { SNSSlackMessageLambdaSubscription } from '@gammarers/aws-sns-slack-message-lambda-subscription';
import { Duration, Names, Stack, StackProps } from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';
import { NotificationStateMachine } from './resources/notification-state-machine';

export { CodePipelineExecutionStateChangeNotificationStackResourceNamingType };

export interface TargetResourceProperty {
  readonly tagKey: string;
  readonly tagValues: string[];
}

export interface Slack {
  readonly webhookSecretName: string;
}

export interface NotificationsProperty {
  readonly emails?: string[];
  readonly slack?: Slack;
}

export interface CodePipelineExecutionStateChangeNotificationStackProps extends StackProps {
  readonly targetResource: TargetResourceProperty;
  readonly enabled?: boolean;
  readonly notifications: NotificationsProperty;
  readonly resourceNamingOption?: ResourceNamingOption;
}

export interface CustomNaming {
  readonly type: CodePipelineExecutionStateChangeNotificationStackResourceNamingType.CUSTOM;
  readonly stateMachineName: string;
  readonly notificationTopicName: string;
  readonly notificationTopicDisplayName: string;
  readonly pipelineEventDetectionRuleName: string;
}

export type ResourceNamingOption = ResourceDefaultNaming | ResourceAutoNaming | CustomNaming;

export class CodePipelineExecutionStateChangeNotificationStack extends Stack {
  constructor(scope: Construct, id: string, props: CodePipelineExecutionStateChangeNotificationStackProps) {
    super(scope, id, props);

    // 👇 Create random 8 length string
    const random = ResourceNaming.createRandomString(`${Names.uniqueId(scope)}.${Names.uniqueId(this)}`);
    // 👇 Auto naeming
    const autoNaming = {
      stateMachineName: `codepipeline-exec-state-change-notification-${random}-machine`,
      notificationTopicName: `codepipeline-execution-state-change-notification-${random}-topic`,
      notificationTopicDisplayName: 'CodePipeline Execution state change Notification Topic',
      pipelineEventDetectionRuleName: `codepipeline-exe-state-change-${random}-detection-event-rule`,
    };
    // 👇 Resource Names
    const names = ResourceNaming.naming(autoNaming, props.resourceNamingOption as ResourceNaming.ResourceNamingOption);

    // 👇 SNS Topic for notifications
    const topic: sns.Topic = new sns.Topic(this, 'NotificationTopic', {
      topicName: names.notificationTopicName,
      displayName: names.notificationTopicDisplayName,
    });

    //    const secret = cdk.SecretValue.secretsManager('my-email-array-secret');
    //    const emails = JSON.parse(secret.unsafeUnwrap()) as string[];

    // Subscribe an email endpoint to the topic
    const emails = props.notifications.emails ?? [];
    for (const email of emails) {
      topic.addSubscription(new subscriptions.EmailSubscription(email));
    }

    // 👇 Subscription slack webhook
    if (props.notifications?.slack) {
      new SNSSlackMessageLambdaSubscription(this, 'SNSSlackMessageLambdaSubscription', {
        topic,
        slackWebhookSecretName: props.notifications.slack.webhookSecretName,
      });
    }

    // Subscribe a HTTP endpoint (Slack Webhook) to the topic
    // topic.addSubscription(new subs.UrlSubscription('https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'));

    // 👇 Create State Machine
    const stateMachine = new NotificationStateMachine(this, 'StateMachine', {
      stateMachineName: names.stateMachineName,
      timeout: Duration.minutes(5),
      notificationTopic: topic,
    });

    // 👇 Rule state
    //enabled
    const enableRule: boolean = (() => {
      return props?.enabled === undefined || props.enabled;
    })();

    // 👇 Create EventBridge Rule
    new CodePipelinePipelineExecutionStateChangeDetectionEventRule(this, 'EventRule', {
      ruleName: names.pipelineEventDetectionRuleName,
      enabled: enableRule,
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
