/* eslint no-console: ["error", { allow: ["info", "warn", "error"] }] */

const http = require('http');
const syncRequest = require('sync-request');
const url = require('url');
const fs = require('fs')
const pem2jwk = require('pem-jwk').pem2jwk;
const request = require('request');
const jwt = require('jsonwebtoken');

const userAccount = process.env.KHEOPS_SERVICE_ACCOUNT_USER;
const userPrivKey = fs.readFileSync('/run/secrets/privkey.pem', 'ascii');

const userAccount = process.env.KHEOPS_PROXY_PACS_WADO_RS






