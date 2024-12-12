import { awscdk, javascript } from 'projen';
const project = new awscdk.AwsCdkConstructLibrary({
  author: 'yicr',
  authorAddress: 'yicr@users.noreply.github.com',
  authorOrganization: true,
  cdkVersion: '2.100.0',
  defaultReleaseBranch: 'main',
  typescriptVersion: '5.5.x',
  jsiiVersion: '5.5.x',
  name: '@gammarers/aws-codepipeline-execution-state-change-notification-stack',
  description: 'This AWS CDK Construct Stack receives all state changes of CodePipeline and sends a message to the specified notification destination when the CodePipeline is tagged with a specified tag. Therefore, you can send messages simply by adding tags without needing to configure notifications for each Pipeline.',
  keywords: ['aws', 'cdk', 'codepipeline', 'notification', 'email'],
  projenrcTs: true,
  repositoryUrl: 'https://github.com/gammarers/aws-codepipeline-execution-state-change-notification-stack.git',
  deps: [
    '@gammarers/aws-codesuite-state-change-detection-event-rules@^2.0.6',
    '@gammarers/aws-resource-naming@^0.10.2',
  ],
  peerDeps: [
    '@gammarers/aws-resource-naming@^0.10.2',
  ],
  majorVersion: 2,
  releaseToNpm: true,
  npmAccess: javascript.NpmAccess.PUBLIC,
  depsUpgrade: true,
  depsUpgradeOptions: {
    workflowOptions: {
      labels: ['auto-approve', 'auto-merge'],
      schedule: javascript.UpgradeDependenciesSchedule.expressions(['12 18 * * 4']), // every friday 18:05
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