import { awscdk, javascript } from 'projen';
const project = new awscdk.AwsCdkConstructLibrary({
  author: 'yicr',
  authorAddress: 'yicr@users.noreply.github.com',
  authorOrganization: true,
  cdkVersion: '2.100.0',
  defaultReleaseBranch: 'main',
  typescriptVersion: '5.4.x',
  jsiiVersion: '5.4.x',
  name: '@gammarers/aws-codepipeline-event-notification-stack',
  description: 'AWS CodePipeline Event(started,succeeded,resumed,failed,stopping,stopped,superseded) Notification',
  keywords: ['aws', 'cdk', 'codepipeline', 'notification', 'email'],
  projenrcTs: true,
  repositoryUrl: 'https://github.com/gammarers/aws-codepipeline-event-notification-stack.git',
  deps: [
    '@gammarers/aws-codepipeline-execution-state-change-detection-event-rule@1.1.x',
  ],
  majorVersion: 1,
  releaseToNpm: true,
  npmAccess: javascript.NpmAccess.PUBLIC,
  depsUpgrade: true,
  depsUpgradeOptions: {
    workflowOptions: {
      labels: ['auto-approve', 'auto-merge'],
      schedule: javascript.UpgradeDependenciesSchedule.expressions(['5 18 * * 5']), // every friday 18:05
    },
  },
  minNodeVersion: '18.0.0',
  workflowNodeVersion: '22.4.x',
  autoApproveOptions: {
    secret: 'GITHUB_TOKEN',
    allowedUsernames: ['yicr'],
  },
});
project.synth();