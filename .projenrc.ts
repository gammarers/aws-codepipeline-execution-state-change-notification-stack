import { awscdk } from 'projen';
const project = new awscdk.AwsCdkConstructLibrary({
  author: 'yicr',
  authorAddress: 'yicr@users.noreply.github.com',
  authorOrganization: true,
  cdkVersion: '2.100.0',
  defaultReleaseBranch: 'main',
  typescriptVersion: '5.3.x',
  jsiiVersion: '5.3.x',
  name: '@gammarers/aws-code-pipelineevent-notification-stack',
  projenrcTs: true,
  repositoryUrl: 'https://github.com/gammarers/aws-codepipeline-event-notification-stack.git',
  releaseToNpm: false, // temporary
  depsUpgrade: false, // temporary
});
project.synth();