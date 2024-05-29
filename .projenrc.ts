import { awscdk } from 'projen';
const project = new awscdk.AwsCdkConstructLibrary({
  author: 'yicr',
  authorAddress: 'yicr@users.noreply.github.com',
  authorOrganization: true,
  cdkVersion: '2.100.0',
  defaultReleaseBranch: 'main',
  typescriptVersion: '5.3.x',
  jsiiVersion: '5.3.x',
  name: '@gammarers/aws-code-pipeline-event-notification-stack',
  projenrcTs: true,
  repositoryUrl: 'https://github.com/yicr/aws-code-pipeline-event-notification-stack.git',
});
project.synth();