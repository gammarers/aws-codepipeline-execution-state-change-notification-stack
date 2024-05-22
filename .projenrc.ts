import { awscdk } from 'projen';
const project = new awscdk.AwsCdkConstructLibrary({
  author: 'yicr',
  authorAddress: 'yicr@users.noreply.github.com',
  authorOrganization: true,
  cdkVersion: '2.80.0',
  defaultReleaseBranch: 'main',
  typescriptVersion: '5.4.x',
  jsiiVersion: '5.4.x',
  name: '@gammarers/aws-code-pipeline-notification-stack',
  projenrcTs: true,
  repositoryUrl: 'https://github.com/yicr/aws-code-pipeline-notification-stack.git',
});
project.synth();