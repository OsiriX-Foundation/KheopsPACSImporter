/* eslint no-console: ["error", { allow: ["info", "warn", "error"] }] */
/* eslint no-console: ["error", { allow: ["info", "warn", "error"] }] */

const fs = require('fs');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const userAccount = process.env.KHEOPS_SERVICE_ACCOUNT_USER;
const importerToken = process.env.IMPORTER_TOKEN;
const userPrivKeyPem = fs.readFileSync('/run/secrets/privkey.pem', 'ascii');
const dicomwebURL = process.env.KHEOPS_PROXY_PACS_WADO_RS;
const authorizationURL = `http://${process.env.KHEOPS_AUTHORIZATION_HOST}:${process.env.KHEOPS_AUTHORIZATION_PORT}${process.env.KHEOPS_AUTHORIZATION_PATH}`;

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

async function importSeries(studyUID, seriesUIDs) {
  const authorizedSeriesUIDs = [];
  for (let i = 0; i < seriesUIDs.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const putResult = await axios.put(`${authorizationURL}/studies/${studyUID}/series/${seriesUIDs[i]}`,
      {
        headers: { Authorization: `Bearer ${importerToken}` },
        validateStatus(status) {
          return status >= 200 && status < 500;
        },
      });

    if (putResult.status >= 200 && putResult < 300) {
      console.info(`Successfully Claimed StudyUID:${studyUID} SeriesUID${seriesUIDs[i]}`);
      authorizedSeriesUIDs.push(seriesUIDs[i]);
    } else {
      console.info(`Unable to Claim StudyUID:${studyUID} SeriesUID${seriesUIDs[i]}`);
    }
  }

  const params = new URLSearchParams();

  authorizedSeriesUIDs.forEach((seriesUID) => params.append('SeriesInstanceUID', seriesUID));
  await axios.post(`${authorizationURL}/studies/${studyUID}/fetch`, params,
    { headers: { Authorization: `Bearer ${importerToken}` } });

  console.info(`Finished fetch for StudyUID:${studyUID}`);
}

((async function process() {
  const accessToken = await getAccessToken();
  const studyUIDs = await getStudyUIDs(accessToken);

  for (let i = 0; i < studyUIDs.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const seriesUIDs = await getSeriesUIDs(studyUIDs[i], accessToken);

    // eslint-disable-next-line no-await-in-loop
    await importSeries(studyUIDs[i], seriesUIDs);
  }
}()).catch((error) => {
  console.info(error);
}));
