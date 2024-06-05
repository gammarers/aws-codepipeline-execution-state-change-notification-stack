import { awscdk, javascript } from 'projen';
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
  npmAccess: javascript.NpmAccess.PUBLIC,
  depsUpgrade: false, // temporary
  minNodeVersion: '18.0.0',
  workflowNodeVersion: '22.2.0',
});
project.synth();