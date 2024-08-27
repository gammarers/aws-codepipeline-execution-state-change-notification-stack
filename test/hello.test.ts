import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { CodePipelineExecutionStateChangeNotificationStack } from '../src';

test('hello', () => {
  const app = new App();

  const stack = new CodePipelineExecutionStateChangeNotificationStack(app, 'CodePipelineEventNotificationStack', {
    targetResource: {
      tagKey: 'DeployNotification',
      tagValues: ['YES'],
    },
    notifications: {
      emails: [
        'foo@example.com',
      ],
    },
  });

  const template = Template.fromStack(stack);

  expect(template.toJSON()).toMatchSnapshot();
});