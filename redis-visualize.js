#!/usr/bin/env node
/*
 * Copyright (c) 2016 Xamarin Inc.
 *
 * Authored by: Michal Hruby <michal.mhr@gmail.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom
 * the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

var http = require('http');
var fs = require('fs');
var path = require('path');
var querystring = require('querystring');
var url = require('url');
var util = require('util');
var redis = require('redis');
var stream = require('stream');
var zlib = require('zlib');

const PORT = 8079;

var REDIS_HOST = 'localhost';
var REDIS_PORT = 6379;
var DEFAULT_TIMEOUT = 500;
var REDIS_PASSWORD = undefined;

const LUA_SCRIPT = String.raw`
local key = redis.call('randomkey');
local ttl = redis.call('ttl', key);
local type = redis.call('type', key)['ok'];

local size = 0;
if type == 'string' then size = redis.call('strlen', key);
elseif type == 'list' then size = redis.call('llen', key);
elseif type == 'set' then size = redis.call('scard', key);
elseif type == 'zset' then size = redis.call('zcard', key);
elseif type == 'hash' then size = redis.call('hlen', key);
end;

return {key, ttl, type, size}
`.replace(/\n/g, '');

var clients = {};

function getRedisData(params, done) {
  var host = params.redishost || REDIS_HOST;
  var port = params.redisport || REDIS_PORT;
  var password = params.redispassword || REDIS_PASSWORD;
  var timeout = parseInt(params.timeout) || DEFAULT_TIMEOUT;

  var key = util.format("%s:%s", host, port);
  var client = clients[key];
  if (!client){
    client = redis.createClient(port, host, { password: password, retry_strategy: (options) => {
      if (options.error) {
        delete clients[key];
        return options.error;
      }
      return false;
    } });
    // don't want to crash
    client.on('error', () => {});
    clients[key] = client;
  }

  var results = [];
  var startTime = Date.now();
  var getNext = () => {
    client.eval(LUA_SCRIPT, 0, (err, keyData) => {
      if (err) return done(err);

      results.push({key: keyData[0], ttl: keyData[1], type: keyData[2], size: keyData[3]});
      if (Date.now() - startTime > timeout){
        return done(null, results);
      }
      getNext();
    });
  };

  getNext();
}

function handleRequest(request, response) {
  if (request.method != 'GET'){
    response.writeHead(405, {'Content-Type': 'text/plain'});
    response.end('Request method not supported');
    return;
  }

  var parsed = url.parse(request.url);

  switch (parsed.pathname){
    case '/':
    case '/index.html':
      response.writeHead(200, {'Content-Type': 'text/html'});
      var f = fs.createReadStream(path.join(__dirname, 'index.html'));
      f.pipe(response);
      break;
    case '/api/data':
      getRedisData(querystring.parse(parsed.query), (err, data) => {
        if (err) {
          response.writeHead(500, {'Content-Type': 'application/json'});
          response.end(JSON.stringify({error: err.message}));
          return;
        }
        var content = JSON.stringify(data);
        var ae = request.headers['accept-encoding'];
        if (ae && ae.match(/\bgzip\b/)){
          response.writeHead(200, {'Content-Type': 'application/json', 'Content-Encoding': 'gzip'});
          var r = new stream.Readable();
          r.push(content);
          r.push(null);
          r.pipe(zlib.createGzip()).pipe(response);
        } else {
          response.writeHead(200, {'Content-Type': 'application/json'});
          response.end(content);
        }
      });
      break;
    default:
      response.writeHead(404, {'Content-Type': 'text/plain'});
      response.end('Not found');
      break;
  }
}

var argv = process.argv;
var port = PORT;
var server = http.createServer(handleRequest);

if (argv.indexOf('-h') !== -1 || argv.indexOf('--help') !== -1){
  console.log('usage: redis-visualize -p [PORT]');
  return;
}

var index;
if ((index = argv.indexOf('-p')) !== -1 || (index = argv.indexOf('--port')) !== -1){
  port = parseInt(argv[index+1]) || PORT;
}

console.log('Listening on ' + port + '...');
server.listen(port);
