# AWS CodePipeline Event Notification Stack

[![GitHub](https://img.shields.io/github/license/gammarers/aws-codepipeline-execution-state-change-notification-stack?style=flat-square)](https://github.com/gammarers/aws-codepipeline-execution-state-change-notification-stack/blob/main/LICENSE)
[![npm (scoped)](https://img.shields.io/npm/v/@gammarers/aws-codepipeline-execution-state-change-notification-stack?style=flat-square)](https://www.npmjs.com/package/@gammarers/aws-codepipeline-execution-state-change-notification-stack)
[![GitHub Workflow Status (branch)](https://img.shields.io/github/actions/workflow/status/gammarers/aws-codepipeline-execution-state-change-notification-stack/release.yml?branch=main&label=release&style=flat-square)](https://github.com/gammarers/aws-codepipeline-execution-state-change-notification-stack/actions/workflows/release.yml)
[![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/gammarers/aws-codepipeline-execution-state-change-notification-stack?sort=semver&style=flat-square)](https://github.com/gammarers/aws-codepipeline-execution-state-change-notification-stack/releases)

[![View on Construct Hub](https://constructs.dev/badge?package=@gammarers/aws-codepipeline-execution-state-change-notification-stack)](https://constructs.dev/packages/@gammarers/aws-codepipeline-execution-state-change-notification-stack)

This AWS CDK Construct Stack receives all state changes of CodePipeline and sends a message to the specified notification destination when the CodePipeline is tagged with a specified tag. Therefore, you can send messages simply by adding tags without needing to configure notifications for each Pipeline.

## Install

### TypeScript

#### install by npm

```shell
npm install @gammarers/aws-codepipeline-execution-state-change-notification-stack
```
#### install by yarn

```shell
yarn add @gammarers/aws-codepipeline-execution-state-change-notification-stack
```
#### install by pnpm

```shell
pnpm add @gammarers/aws-codepipeline-execution-state-change-notification-stack
```
#### install by bun

```shell
bun add @gammarers/aws-codepipeline-execution-state-change-notification-stack
```

## Example

```typescript
import { App } from 'aws-cdk-lib';
import { RDSDatabaseAutoRunningStopStack } from '@gammarers/aws-rds-database-auto-running-stop-stack';

const app = new App();

const stack = new CodePipelineExecutionStateChangeNotificationStack(app, 'CodePipelineExecutionStateChangeNotificationStack', {
targetResource: { // required
  tagKey: 'PipelineExecutionStateChangeNotification', // required, Specify the tag key set in CodePipeline
  tagValues: ['YES'], // required, Specify the tag value set in CodePipeline
},
notifications: {
  emails: [ // optional (but not notification)
    'foo@example.com',
  ],
},
});

```

## License

This project is licensed under the Apache-2.0 License.
