import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { CodePipelineExecutionStateChangeNotificationStack, CodePipelineExecutionStateChangeNotificationStackResourceNamingType } from '../src';

describe('Stack Specific Testing', () => {

  const app = new App();

  const stack = new CodePipelineExecutionStateChangeNotificationStack(app, 'CodePipelineEventNotificationStack', {
    enabled: true,
    targetResource: {
      tagKey: 'DeployNotification',
      tagValues: ['YES'],
    },
    notifications: {
      emails: [
        'foo@example.com',
      ],
    },
    resourceNamingOption: {
      type: CodePipelineExecutionStateChangeNotificationStackResourceNamingType.AUTO,
    },
  });

  const template = Template.fromStack(stack);

  it('Should match snapshot', () => {
    expect(template.toJSON()).toMatchSnapshot();
  });

});
