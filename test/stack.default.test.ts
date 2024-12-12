import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { CodePipelineExecutionStateChangeNotificationStack } from '../src';

describe('Stack Default Testing', () => {

  const app = new App();

  const stack = new CodePipelineExecutionStateChangeNotificationStack(app, 'CodePipelineEventNotificationStack', {
    targetResource: {
      tagKey: 'DeployNotification',
      tagValues: ['YES'],
    },
    notifications: {},
  });

  const template = Template.fromStack(stack);

  it('Should match state machine count', () => {
    template.resourceCountIs('AWS::StepFunctions::StateMachine', 1);
  });

  it('Should match iam role count', () => {
    template.resourceCountIs('AWS::IAM::Role', 2);
  });

  it('Should match event rule count', () => {
    template.resourceCountIs('AWS::Events::Rule', 1);
  });

  it('Should match snapshot', () => {
    expect(template.toJSON()).toMatchSnapshot();
  });

});
