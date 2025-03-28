import dayjs from 'dayjs';
import { convertToTargetFormat, getDateFormat } from 'nocodb-sdk';
import commonFns from './commonFns';
import type { MapFnArgs } from '../mapFunctionName';
import { convertUnits } from '~/helpers/convertUnits';
import { getWeekdayByText } from '~/helpers/formulaFnHelper';

const sqlite3 = {
  ...commonFns,
  LEN: 'LENGTH',
  async CEILING(args) {
    return {
      builder: args.knex.raw(
        `round(${(await args.fn(args.pt.arguments[0])).builder} + 0.5)`,
      ),
    };
  },
  async FLOOR(args) {
    return {
      builder: args.knex.raw(
        `round(${(await args.fn(args.pt.arguments[0])).builder} - 0.5)`,
      ),
    };
  },
  MOD: async (args: MapFnArgs) => {
    return args.fn({
      type: 'BinaryExpression',
      operator: '%',
      left: args.pt.arguments[0],
      right: args.pt.arguments[1],
    });
  },
  async REPEAT(args: MapFnArgs) {
    return {
      builder: args.knex.raw(
        `replace(printf('%.' || ${
          (await args.fn(args.pt.arguments[1])).builder
        } || 'c', '/'),'/',${(await args.fn(args.pt.arguments[0])).builder})`,
      ),
    };
  },
  NOW: (args: MapFnArgs) => {
    return {
      builder: args.knex.raw(`DATETIME('now', 'localtime')`),
    };
  },
  SEARCH: 'INSTR',
  async INT(args: MapFnArgs) {
    return {
      builder: args.knex.raw(
        `CAST(${(await args.fn(args.pt.arguments[0])).builder} as INTEGER)`,
      ),
    };
  },
  LEFT: async (args: MapFnArgs) => {
    const source = (await args.fn(args.pt.arguments[0])).builder;
    const length = (await args.fn(args.pt.arguments[1])).builder;
    return {
      builder: args.knex.raw(`SUBSTR(?,1,?)`, [source, length]),
    };
  },
  RIGHT: async (args: MapFnArgs) => {
    const source = (await args.fn(args.pt.arguments[0])).builder;
    const length = (await args.fn(args.pt.arguments[1])).builder;
    return {
      builder: args.knex.raw(`SUBSTR(?,-(?))`, [source, length]),
    };
  },
  MID: 'SUBSTR',
  FLOAT: async (args: MapFnArgs) => {
    return {
      builder: args.knex
        .raw(`CAST(${(await args.fn(args.pt.arguments[0])).builder} as FLOAT)`)
        .wrap('(', ')'),
    };
  },
  DATEADD: async ({ fn, knex, pt }: MapFnArgs) => {
    const source = (await fn(pt.arguments[0])).builder;
    let dateIN = (await fn(pt.arguments[1])).builder;
    if (typeof dateIN === 'object' && dateIN.toQuery) {
      dateIN = Number(dateIN.toQuery());
    }

    let dateModifier = (await fn(pt.arguments[2])).builder;
    if (typeof dateModifier === 'object' && dateModifier.toQuery) {
      dateModifier = dateModifier.toQuery().replace(/["']/g, '');
    }

    const fullModifier = `${dateIN > 0 ? '+' : ''}${dateIN} ${dateModifier}`;
    return {
      builder: knex.raw(
        `CASE
      WHEN :source LIKE '%:%' THEN
        STRFTIME('%Y-%m-%dT%H:%M:%fZ', DATETIME(:source, 'utc', ':fullModifier'))
      ELSE
        DATE(:source, ':fullModifier')
      END`,
        {
          source,
          fullModifier: knex.raw(fullModifier),
        },
      ),
    };
  },
  DATETIME_DIFF: async ({ fn, knex, pt }: MapFnArgs) => {
    let datetime_expr1 = (await fn(pt.arguments[0])).builder;
    let datetime_expr2 = (await fn(pt.arguments[1])).builder;
    // JULIANDAY takes YYYY-MM-DD
    if (datetime_expr1.sql === '?' && datetime_expr1.bindings?.[0]) {
      datetime_expr1 = `'${convertToTargetFormat(
        datetime_expr1.bindings[0],
        getDateFormat(datetime_expr1.bindings[0]),
        'YYYY-MM-DD',
      )}'`;
    }

    if (datetime_expr2.sql === '?' && datetime_expr2.bindings?.[0]) {
      datetime_expr2 = `'${convertToTargetFormat(
        datetime_expr2.bindings[0],
        getDateFormat(datetime_expr2.bindings[0]),
        'YYYY-MM-DD',
      )}'`;
    }

    const rawUnit = pt.arguments[2]
      ? (await fn(pt.arguments[2])).builder.bindings[0]
      : 'seconds';
    let sql;
    const unit = convertUnits(rawUnit, 'sqlite');
    switch (unit) {
      case 'seconds':
        sql = `(strftime('%s', ${datetime_expr1}) - strftime('%s', ${datetime_expr2}))`;
        break;
      case 'minutes':
        sql = `(strftime('%s', ${datetime_expr1}) - strftime('%s', ${datetime_expr2})) / 60`;
        break;
      case 'hours':
        sql = `(strftime('%s', ${datetime_expr1}) - strftime('%s', ${datetime_expr2})) / 3600`;
        break;
      case 'milliseconds':
        sql = `(strftime('%s', ${datetime_expr1}) - strftime('%s', ${datetime_expr2})) * 1000`;
        break;
      case 'weeks':
        sql = `ROUND((JULIANDAY(${datetime_expr1}) - JULIANDAY(${datetime_expr2})) / 7)`;
        break;
      case 'months':
        sql = `(strftime('%Y', ${datetime_expr1}) - strftime('%Y', ${datetime_expr2})) * 12 + (strftime('%m', ${datetime_expr1}) - strftime('%m', ${datetime_expr2})) `;
        break;
      case 'quarters':
        sql = `(strftime('%Y', ${datetime_expr1}) - strftime('%Y', ${datetime_expr2})) * 4 + (strftime('%m', ${datetime_expr1}) - strftime('%m', ${datetime_expr2})) / 3`;
        break;
      case 'years':
        sql = `CASE
                WHEN (${datetime_expr2} < ${datetime_expr1}) THEN
                (
                  (strftime('%Y', ${datetime_expr1}) - strftime('%Y', ${datetime_expr2}))
                  - (strftime('%m', ${datetime_expr1}) < strftime('%m', ${datetime_expr2})
                  OR (strftime('%m', ${datetime_expr1}) = strftime('%m', ${datetime_expr2})
                  AND strftime('%d', ${datetime_expr1}) < strftime('%d', ${datetime_expr2})))
                )
                WHEN (${datetime_expr2} > ${datetime_expr1}) THEN
                -1 * (
                  (strftime('%Y', ${datetime_expr2}) - strftime('%Y', ${datetime_expr1}))
                  - (strftime('%m', ${datetime_expr2}) < strftime('%m', ${datetime_expr1})
                  OR (strftime('%m', ${datetime_expr2}) = strftime('%m', ${datetime_expr1})
                  AND strftime('%d', ${datetime_expr2}) < strftime('%d', ${datetime_expr1})))
                )
                ELSE 0
              END`;
        break;
      case 'days':
        sql = `JULIANDAY(${datetime_expr1}) - JULIANDAY(${datetime_expr2})`;
        break;
      default:
        sql = '';
    }
    return { builder: knex.raw(`ROUND(${sql})`) };
  },
  WEEKDAY: async ({ fn, knex, pt }: MapFnArgs) => {
    // strftime('%w', date) - day of week 0 - 6 with Sunday == 0
    // WEEKDAY() returns an index from 0 to 6 for Monday to Sunday
    return {
      builder: knex.raw(
        `(strftime('%w', ${
          pt.arguments[0].type === 'Literal'
            ? `'${dayjs((await fn(pt.arguments[0])).builder).format(
                'YYYY-MM-DD',
              )}'`
            : (await fn(pt.arguments[0])).builder
        }) - 1 - ${getWeekdayByText(pt?.arguments[1]?.value)} % 7 + 7) % 7`,
      ),
    };
  },
  DAY: async ({ fn, knex, pt }: MapFnArgs) => {
    return {
      builder: knex.raw(
        `CAST(strftime('%d', (${
          (await fn(pt?.arguments[0])).builder
        })) AS INTEGER)`,
      ),
    };
  },
  MONTH: async ({ fn, knex, pt }: MapFnArgs) => {
    return {
      builder: knex.raw(
        `CAST(strftime('%m', (${
          (await fn(pt?.arguments[0])).builder
        })) AS INTEGER)`,
      ),
    };
  },
  YEAR: async ({ fn, knex, pt }: MapFnArgs) => {
    return {
      builder: knex.raw(
        `CAST(strftime('%Y', (${
          (await fn(pt?.arguments[0])).builder
        })) AS INTEGER)`,
      ),
    };
  },
  HOUR: async ({ fn, knex, pt }: MapFnArgs) => {
    return {
      builder: knex.raw(
        `CAST(strftime('%H', (${
          (await fn(pt?.arguments[0])).builder
        })) AS INTEGER)`,
      ),
    };
  },
  AND: async (args: MapFnArgs) => {
    const predicates = (args.pt.arguments.map(() => '?') as string[]).join(
      ' AND ',
    );

    const parsedArguments = await Promise.all(
      args.pt.arguments.map(async (ar) => {
        const argsStr = (await args.fn(ar, '', 'AND')).builder;
        return { builder: argsStr };
      }),
    );

    const clause = args.knex
      .raw(
        predicates,
        parsedArguments.map((a) => a.builder),
      )
      .wrap('(', ')');

    return {
      builder: args.knex.raw(`CASE WHEN ? THEN 1 ELSE 0 END `, [clause]),
    };
  },
  OR: async (args: MapFnArgs) => {
    const predicates = (args.pt.arguments.map(() => '?') as string[]).join(
      ' OR ',
    );

    const parsedArguments = await Promise.all(
      args.pt.arguments.map(async (ar) => {
        const argsStr = (await args.fn(ar, '', 'OR')).builder;
        return { builder: argsStr };
      }),
    );

    const clause = args.knex
      .raw(
        predicates,
        parsedArguments.map((a) => a.builder),
      )
      .wrap('(', ')');

    return {
      builder: args.knex.raw(`CASE WHEN ? THEN 1 ELSE 0 END `, [clause]),
    };
  },
  async JSON_EXTRACT(args: MapFnArgs) {
    const source = (await args.fn(args.pt.arguments[0])).builder;
    const needle = (await args.fn(args.pt.arguments[1])).builder;
    return {
      builder: args.knex.raw(
        `CASE WHEN json_valid(:source) = 1 THEN json_extract(:source, CONCAT('$', :needle)) ELSE NULL END`,
        {
          source,
          needle,
        },
      ),
    };
  },
};

export default sqlite3;
