/* eslint no-console: ["error", { allow: ["info", "warn", "error"] }] */
/* eslint no-console: ["error", { allow: ["info", "warn", "error"] }] */

// const http = require('http');
// const syncRequest = require('sync-request');
// const url = require('url');
const fs = require('fs');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const userAccount = process.env.KHEOPS_SERVICE_ACCOUNT_USER;
const userPrivKeyPem = fs.readFileSync('/run/secrets/privkey.pem', 'ascii');
const dicomwebURL = process.env.KHEOPS_PROXY_PACS_WADO_RS;

console.info(`dicomwebURL=${dicomwebURL}`);

async function getAccessToken() {
  const authenticationJWT = jwt.sign({
    scope: 'https://www.googleapis.com/auth/cloud-platform',
  }, userPrivKeyPem, {
    algorithm: 'RS256',
    issuer: userAccount,
    audience: 'https://oauth2.googleapis.com/token',
    expiresIn: '5m',
  });

  const params = new URLSearchParams();
  params.append('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  params.append('assertion', authenticationJWT);

  return (await axios.post('https://oauth2.googleapis.com/token', params)).data.access_token;
}

async function getStudies(accessToken) {
  return (await axios.get(`${dicomwebURL}/studies`, { headers: { Authorization: `Bearer ${accessToken}` } })).data;
}

async function getStudyUIDs(accessToken) {
  return (await getStudies(accessToken)).map((study) => study['0020000D'].Value[0]);
}

async function getSeries(studyUID, accessToken) {
  return (await axios.get(`${dicomwebURL}/studies/${studyUID}/series`,
    { headers: { Authorization: `Bearer ${accessToken}` } })).data;
}

async function getSeriesUIDs(studyUID, accessToken) {
  return (await getSeries(studyUID, accessToken)).map((series) => series['0020000E'].Value[0]);
}

((async function listStudyUIDS() {
  const accessToken = await getAccessToken();
  const studyUIDs = await getStudyUIDs(accessToken);

  for (let i = 0; i < studyUIDs.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const seriesUIDs = await getSeriesUIDs(studyUIDs[i], accessToken);
    seriesUIDs.forEach((seriesUID) => console.info(seriesUID));
  }
}()).catch((error) => {
  console.info(error);
}));
