// RFC 9457 — Problem Details for HTTP APIs.

export interface ProblemField {
  pointer: string;
  detail: string;
}

export interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: ProblemField[];
  trace_id?: string;
}

const PROBLEM_BASE = 'https://api.mctl.ai/problems/';

export class HttpProblem extends Error {
  readonly status: number;
  readonly type: string;
  readonly title: string;
  readonly fields?: ProblemField[];
  readonly retryAfterSeconds?: number;

  constructor(opts: {
    status: number;
    slug: string;
    title: string;
    detail?: string;
    fields?: ProblemField[];
    retryAfterSeconds?: number;
  }) {
    super(opts.detail ?? opts.title);
    this.status = opts.status;
    this.type = `${PROBLEM_BASE}${opts.slug}`;
    this.title = opts.title;
    if (opts.detail !== undefined) this.message = opts.detail;
    if (opts.fields) this.fields = opts.fields;
    if (opts.retryAfterSeconds !== undefined) this.retryAfterSeconds = opts.retryAfterSeconds;
  }

  toProblem(instance: string, traceId: string): Problem {
    const p: Problem = { type: this.type, title: this.title, status: this.status, instance, trace_id: traceId };
    if (this.message && this.message !== this.title) p.detail = this.message;
    if (this.fields) p.errors = this.fields;
    return p;
  }
}

export const badRequest = (detail: string, fields?: ProblemField[]): HttpProblem =>
  new HttpProblem({ status: 400, slug: 'bad-request', title: 'Некорректный запрос', detail, fields });

export const unauthorized = (detail = 'Требуется bearer-токен.'): HttpProblem =>
  new HttpProblem({ status: 401, slug: 'unauthorized', title: 'Не авторизован', detail });

export const notFound = (detail: string): HttpProblem =>
  new HttpProblem({ status: 404, slug: 'not-found', title: 'Не найдено', detail });

export const unprocessable = (detail: string, fields?: ProblemField[]): HttpProblem =>
  new HttpProblem({ status: 422, slug: 'invalid-filter', title: 'Недопустимое значение фильтра', detail, fields });

export const tooManyRequests = (retryAfterSeconds: number): HttpProblem =>
  new HttpProblem({
    status: 429,
    slug: 'rate-limited',
    title: 'Слишком много запросов',
    detail: 'Превышен лимит запросов. Повторите позже.',
    retryAfterSeconds,
  });
