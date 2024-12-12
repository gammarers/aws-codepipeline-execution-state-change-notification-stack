import * as crypto from 'crypto';
import { CodePipelineExecutionStateChangeDetectionEventRule } from '@gammarers/aws-codesuite-state-change-detection-event-rules';
import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import { NotificationStateMachine } from './resources/notification-state-machine';

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

    // 👇 Create random 8 length string
    const random: string = crypto.createHash('shake256', { outputLength: 4 })
      .update(cdk.Names.uniqueId(this))
      .digest('hex');

    // 👇 SNS Topic for notifications
    const topic: sns.Topic = new sns.Topic(this, 'NotificationTopic', {
      topicName: `codepipeline-execution-state-change-notification-${random}-topic`,
      displayName: 'CodePipeline Execution state change Notification Topic',
    });

    //    const secret = cdk.SecretValue.secretsManager('my-email-array-secret');
    //    const emails = JSON.parse(secret.unsafeUnwrap()) as string[];

    // Subscribe an email endpoint to the topic
    const emails = props.notifications.emails ?? [];
    for (const [index, value] of emails.entries()) {
      new sns.Subscription(this, `SubscriptionEmail${index.toString().padStart(3, '0')}`, {
        topic,
        protocol: sns.SubscriptionProtocol.EMAIL,
        endpoint: value,
      });
    }

    // Subscribe a HTTP endpoint (Slack Webhook) to the topic
    // topic.addSubscription(new subs.UrlSubscription('https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'));

    // 👇 Create State Machine
    const stateMachine = new NotificationStateMachine(this, 'StateMachine', {
      stateMachineName: `codepipeline-exec-state-change-notification-${random}-machine`,
      timeout: cdk.Duration.minutes(5),
      notificationTopic: topic,
    });

    // 👇 Rule state
    //enabled
    const enableRule: boolean = (() => {
      return props?.enabled === undefined || props.enabled;
    })();

    // 👇 Create EventBridge Rule
    new CodePipelineExecutionStateChangeDetectionEventRule(this, 'EventRule', {
      ruleName: `codepipeline-exe-state-change-${random}-detection-event-rule`,
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
