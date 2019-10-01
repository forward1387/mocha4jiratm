'use strict';

const Mocha = require('mocha'),
  superagent = require('superagent'),
  _ = require('underscore');

const {
  EVENT_RUN_BEGIN,
  EVENT_RUN_END,
  EVENT_TEST_FAIL,
  EVENT_TEST_PASS,
  EVENT_SUITE_BEGIN,
  EVENT_SUITE_END
} = Mocha.Runner.constants;

let find = (startPoint, tcName) => {
  return superagent
    .get('https://api.adaptavist.io/tm4j/v2/testcases')
    .set('Authorization', `Bearer ${process.env.API_KEY}`)
    .query({ projectKey: process.env.JIRA_PROJECT_KEY, startAt: startPoint, maxResults: 10 })
    .then((res) => {
      let body = JSON.parse(res.text);
      if (_.findWhere(body.values, { name: tcName })) {
        return _.findWhere(body.values, { name: tcName }).key;
      }

      if ((startPoint + body.maxResults) < body.total) {
        return find(startPoint + body.maxResults, tcName);
      } else {
        return undefined;
      }
    });
};

let getTestExecutionBody = () => {
  let body = {
    projectKey: process.env.JIRA_PROJECT_KEY,
    testCaseKey: undefined,
    testCycleKey: process.env.JIRA_TEST_CYCLE_KEY,
    statusName: undefined
  };

  if (process.env.ASSIGNED_TO_ID) {
    body['assignedToId'] = process.env.ASSIGNED_TO_ID;
  }

  return body;
};

class MyReporter {
  constructor(runner) {
    console.log(process.env.API_KEY);
    console.log(process.env.JIRA_PROJECT_KEY);
    console.log(process.env.JIRA_TEST_CYCLE_KEY);

    if (process.env.JTM_ENABLED && JSON.parse(process.env.JTM_ENABLED) === true) {
      let errors = [];

      runner.once(EVENT_RUN_BEGIN, () => {
      }).on(EVENT_SUITE_BEGIN, () => {
      }).on(EVENT_SUITE_END, (suite) => {
        let match = /#(.*)/.exec(suite.title);
        if (match !== null) {
          let body = getTestExecutionBody();
          body['testCaseKey'] = match[1];
          body['comment'] = JSON.stringify(errors);

          for (let ts of suite.tests) {
            if (ts.state === 'failed') {
              body['statusName'] = 'Fail';
            }
          }

          errors = [];
          console.dir(body);
          return superagent
            .post('https://api.adaptavist.io/tm4j/v2/testexecutions')
            .set('Authorization', `Bearer ${process.env.API_KEY}`)
            .send(body)
            .then(() => console.log(`Send "${suite.title}" test result to Jira TM`))
            .catch((err) => console.log(`Fail to send "${suite.title}" test result to Jira TM. Error: ${err.message}`));
        }
      }).on(EVENT_TEST_PASS, test => {
        let match = /#(.*)/.exec(test.title);
        if (match !== null) {
          let body = getTestExecutionBody();
          body['testCaseKey'] = match[1];
          body['statusName'] = 'Pass';
          return superagent
            .post('https://api.adaptavist.io/tm4j/v2/testexecutions')
            .set('Authorization', `Bearer ${process.env.API_KEY}`)
            .send(body)
            .then(() => console.log(`Send "${test.title}" test result to Jira TM`))
            .catch((err) => console.log(`Fail to send "${test.title}" test result to Jira TM. Error: ${err.message}`));
        }
      }).on(EVENT_TEST_FAIL, (test, err) => {
        let match = /#(.*)/.exec(test.title);
        if (match !== null) {
          let body = getTestExecutionBody();
          body['testCaseKey'] = match[1];
          body['statusName'] = 'Fail';
          body['comment'] = err.message;
          return superagent
            .post('https://api.adaptavist.io/tm4j/v2/testexecutions')
            .set('Authorization', `Bearer ${process.env.API_KEY}`)
            .send(body)
            .then(() => console.log(`Send "${test.title}" test result to Jira TM`))
            .catch((err) => console.log(`Fail to send "${test.title}" test result to Jira TM. Error: ${err.message}`));
        }else {
          errors.push({title: test.title, msg: err.message});
        }
      }).once(EVENT_RUN_END, () => {
      });
    }
  }
}

module.exports = MyReporter;