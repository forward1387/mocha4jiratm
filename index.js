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
      .query({projectKey: process.env.JIRA_PROJECT_KEY, startAt: startPoint, maxResults: 10})
      .then((res) => {
          let body = JSON.parse(res.text);
          if (_.findWhere(body.values, {name: tcName})) {
              return _.findWhere(body.values, {name: tcName}).key;
          }
          
          if((startPoint + body.maxResults) < body.total) {
              return find(startPoint + body.maxResults, tcName);
          } else {
            return undefined;
          }
      });
};

class MyReporter {
  constructor(runner) {
    runner.once(EVENT_RUN_BEGIN, () => {
      console.log('start');
    }).on(EVENT_SUITE_BEGIN, () => {
    }).on(EVENT_SUITE_END, () => {
    }).on(EVENT_TEST_PASS, test => {
      return find(0, test.fullTitle).then((key) => {
        if (key) {
          return superagent
            .post('https://api.adaptavist.io/tm4j/v2/testexecutions')
            .set('Authorization', `Bearer ${process.env.API_KEY}`)
            .send({
              projectKey: JIRA_PROJECT_KEY,
              testCaseKey: key,
              testCycleKey: JIRA_TEST_CYCLE_KEY,
              statusName: 'Pass'
            }).catch((err) => console.dir(err));
        }
      });
      //console.log(`${this.indent()}pass: ${test.fullTitle()}`);
    }).on(EVENT_TEST_FAIL, (test, err) => {
      return find(0, test.fullTitle).then((key) => {
        if (key) {
          return superagent
            .post('https://api.adaptavist.io/tm4j/v2/testexecutions')
            .set('Authorization', `Bearer ${process.env.API_KEY}`)
            .send({
              projectKey: JIRA_PROJECT_KEY,
              testCaseKey: key,
              testCycleKey: JIRA_TEST_CYCLE_KEY,
              statusName: 'Fail',
              comment: err.message
            }).catch((err) => console.dir(err));
        }
      });
      //console.log(`${this.indent()}fail: ${test.fullTitle()} - error: ${err.message}`);
    }).once(EVENT_RUN_END, () => {
      console.log(`end`);
    });
  }
}
  
module.exports = MyReporter;