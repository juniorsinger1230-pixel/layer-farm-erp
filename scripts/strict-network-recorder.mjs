import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const MAX_INLINE_BODY = 65_536;
const SENSITIVE_HEADER_PATTERN = /(authorization|cookie|set-cookie|api-key|jwt|token|secret|password|mfa)/i;

export function redactHeaders(headers = {}) {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [
    key,
    SENSITIVE_HEADER_PATTERN.test(key) ? '***' : value,
  ]));
}

export function hashValue(value) {
  return createHash('sha256').update(value).digest('hex');
}

function safeFilePart(value) {
  return String(value).replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 80);
}

function bodyArtifact(value, directory, prefix) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(String(value ?? ''));
  const sha256 = hashValue(buffer);
  const inline = buffer.length <= MAX_INLINE_BODY;
  let bodyPath = null;
  if (!inline) {
    const target = path.join(directory, `${safeFilePart(prefix)}-${sha256.slice(0, 12)}.bin`);
    if (!existsSync(target)) writeFileSync(target, buffer);
    bodyPath = target;
  }
  return {
    length: buffer.length,
    sha256,
    body: inline ? buffer.toString('utf8') : undefined,
    bodyPath,
  };
}

export class StrictNetworkRecorder {
  constructor({ runId, projectRoot, strictRoot }) {
    this.runId = runId;
    this.projectRoot = projectRoot;
    this.strictRoot = strictRoot;
    this.currentCaseId = null;
    this.logDirectory = path.join(strictRoot, 'request-responses');
    this.bodyDirectory = path.join(strictRoot, 'bodies');
    this.browserDirectory = path.join(strictRoot, 'browser');
    mkdirSync(this.logDirectory, { recursive: true });
    mkdirSync(this.bodyDirectory, { recursive: true });
    mkdirSync(this.browserDirectory, { recursive: true });
    this.nodeLogPath = path.join(this.logDirectory, 'node-http.jsonl');
    this.browserLogPath = path.join(this.logDirectory, 'browser-http.jsonl');
  }

  setCurrentCase(caseId) {
    this.currentCaseId = caseId;
  }

  appendEvent(file, event) {
    appendFileSync(file, `${JSON.stringify({ runId: this.runId, caseId: this.currentCaseId, at: new Date().toISOString(), ...event })}\n`);
  }

  attachPage(page, contextName) {
    const pendingRequests = new Map();

    page.on('request', (request) => {
      const postData = request.postData();
      const requestId = request._guid ?? safeFilePart(request.url());
      pendingRequests.set(requestId, {
        method: request.method(),
        url: request.url(),
        resourceType: request.resourceType(),
      });
      this.appendEvent(this.browserLogPath, {
        type: 'request',
        context: contextName,
        requestId,
        method: request.method(),
        url: request.url(),
        resourceType: request.resourceType(),
        headers: redactHeaders(request.headers()),
        requestBody: postData === null || postData === undefined
          ? null
          : bodyArtifact(postData, this.bodyDirectory, `${contextName}-request`),
      });
    });

    page.on('response', (response) => {
      const request = response.request();
      const url = response.url();
      const requestId = request._guid ?? safeFilePart(url);
      pendingRequests.delete(requestId);
      const contentType = response.headers()['content-type'] ?? '';
      const shouldCaptureBody = url.includes('/api/') || /json|text|pdf/i.test(contentType);
      const responseEvent = {
        type: 'response',
        context: contextName,
        requestId,
        method: request.method(),
        url,
        status: response.status(),
        headers: redactHeaders(response.headers()),
      };
      if (shouldCaptureBody) {
        response.body()
          .then((buffer) => {
            responseEvent.responseBody = bodyArtifact(buffer, this.bodyDirectory, `${contextName}-response`);
            this.appendEvent(this.browserLogPath, responseEvent);
          })
          .catch((error) => {
            responseEvent.bodyCaptureError = error.message;
            this.appendEvent(this.browserLogPath, responseEvent);
          });
      } else {
        this.appendEvent(this.browserLogPath, responseEvent);
      }
    });

    page.on('requestfinished', (request) => {
      const requestId = request._guid ?? safeFilePart(request.url());
      pendingRequests.delete(requestId);
      this.appendEvent(this.browserLogPath, {
        type: 'requestfinished',
        context: contextName,
        requestId,
        method: request.method(),
        url: request.url(),
      });
    });

    page.on('requestfailed', (request) => {
      const requestId = request._guid ?? safeFilePart(request.url());
      pendingRequests.delete(requestId);
      this.appendEvent(this.browserLogPath, {
        type: 'requestfailed',
        context: contextName,
        requestId,
        method: request.method(),
        url: request.url(),
        failure: request.failure(),
      });
    });

    page.on('close', () => {
      for (const [requestId, requestInfo] of pendingRequests.entries()) {
        this.appendEvent(this.browserLogPath, {
          type: 'requestteardown',
          context: contextName,
          requestId,
          method: requestInfo.method,
          url: requestInfo.url,
          resourceType: requestInfo.resourceType,
          reason: 'browser-closed-before-terminal-network-event',
        });
      }
      pendingRequests.clear();
    });

    page.on('console', (message) => {
      this.appendEvent(path.join(this.browserDirectory, 'console.jsonl'), {
        type: 'console',
        context: contextName,
        level: message.type(),
        text: message.text(),
      });
    });

    page.on('pageerror', (error) => {
      this.appendEvent(path.join(this.browserDirectory, 'pageerror.jsonl'), {
        type: 'pageerror',
        context: contextName,
        message: error.message,
        stack: error.stack,
      });
    });
  }

  async recordNodeFetch(url, options, response) {
    const cloned = response.clone();
    let text = '';
    try { text = await cloned.text(); } catch (error) {
      this.appendEvent(this.nodeLogPath, { type: 'node-http', url, bodyCaptureError: error.message });
      return;
    }
    const requestBody = options?.body === undefined || options.body === null
      ? null
      : bodyArtifact(options.body, this.bodyDirectory, 'node-request');
    const responseBody = bodyArtifact(text, this.bodyDirectory, 'node-response');
    this.appendEvent(this.nodeLogPath, {
      type: 'node-http',
      method: options?.method ?? 'GET',
      url: String(url),
      requestHeaders: redactHeaders(options?.headers),
      requestBody,
      response: {
        status: response.status,
        ok: response.ok,
        headers: redactHeaders(Object.fromEntries(response.headers.entries())),
        responseBody,
      },
    });
  }

  recordNodeFetchError(url, options, error) {
    this.appendEvent(this.nodeLogPath, {
      type: 'node-http-error',
      method: options?.method ?? 'GET',
      url: String(url),
      requestHeaders: redactHeaders(options?.headers),
      error: error.message,
    });
  }

  filterCaseEvents(caseId, targetPath) {
    const sources = [
      this.nodeLogPath,
      this.browserLogPath,
      path.join(this.browserDirectory, 'console.jsonl'),
      path.join(this.browserDirectory, 'pageerror.jsonl'),
    ];
    const matched = [];
    for (const source of sources) {
      if (!existsSync(source)) continue;
      for (const line of readFileSync(source, 'utf8').split(/\r?\n/).filter(Boolean)) {
        const event = JSON.parse(line);
        if (event.caseId === caseId) matched.push(event);
      }
    }
    writeFileSync(targetPath, matched.map((event) => JSON.stringify(event)).join('\n'));
  }
}

export async function recordedFetch(recorder, url, options = {}) {
  try {
    const response = await fetch(url, options);
    if (recorder) await recorder.recordNodeFetch(url, options, response);
    return response;
  } catch (error) {
    recorder?.recordNodeFetchError(url, options, error);
    throw error;
  }
}
