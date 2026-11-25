// Vendored from @remix-run/data-table-sqlite@1.1.0, which remix@3.3.0 ships
// (packages/data-table-sqlite/src/lib/sql-compiler.ts), MIT, Copyright (c)
// 2025 Shopify Inc. The full licence is in LICENSE.remix beside this package.
//
// Only the import specifiers changed, from the private
// `@remix-run/data-table*` package names to the public `remix/*` subpaths this
// package resolves. The rest differs only by this repository's formatter, so
// an upstream revision run through `mise run fmt` diffs cleanly against it.
//
// Every clause comes from `remix/data-table/sql-helpers`, the compilers all
// drivers share; this file only assembles them into SQLite statements. It is
// here because `remix/data-table/sqlite` exports exactly `createSqliteDatabase`
// and `SqliteDatabase`, and its driver reaches `compileSqliteOperation` through
// a relative import. Until upstream exposes it or ships a D1 dialect, the
// options are to vendor this or to reimplement it.

import type { DataManipulationOperation, SqlStatement } from "remix/data-table";
import type { SqlCompileContext } from "remix/data-table/sql-helpers";

import { getTableName, getTablePrimaryKey } from "remix/data-table";
import {
    collectColumns,
    compileFromClause,
    compileGroupByClause,
    compileHavingClause,
    compileLimitOffsetClause,
    compileOrderByClause,
    compileReturningClause,
    compileWhereClause,
    quotePath,
} from "remix/data-table/sql-helpers";

type UpsertOperation = Extract<DataManipulationOperation, { kind: "upsert" }>;
type InsertOperation = Extract<DataManipulationOperation, { kind: "insert" | "insertMany" }>;

type CompileContext = SqlCompileContext & {
    values: unknown[];
};

export function quoteIdentifier(value: string): string {
    return '"' + value.replace(/"/g, '""') + '"';
}

function quote(path: string): string {
    return quotePath(path, quoteIdentifier);
}

export function compileSqliteOperation(operation: DataManipulationOperation): SqlStatement {
    if (operation.kind === "raw") {
        return {
            text: operation.sql.text,
            values: [...operation.sql.values],
        };
    }

    let values: unknown[] = [];
    let context: CompileContext = {
        values,
        quoteIdentifier,
        bindValue(value) {
            // SQLite has no boolean type, so bind booleans as integers.
            values.push(typeof value === "boolean" ? (value ? 1 : 0) : value);
            return "?";
        },
    };

    if (operation.kind === "select") {
        let selection = "*";

        if (operation.select !== "*") {
            selection = operation.select
                .map(field => quote(field.column) + " as " + quoteIdentifier(field.alias))
                .join(", ");
        }

        return {
            text:
                "select " +
                (operation.distinct ? "distinct " : "") +
                selection +
                compileFromClause(operation.table, operation.joins, context) +
                compileWhereClause(operation.where, context) +
                compileGroupByClause(operation.groupBy, context) +
                compileHavingClause(operation.having, context) +
                compileOrderByClause(operation.orderBy, context) +
                compileLimitOffsetClause(operation.limit, operation.offset, context),
            values,
        };
    }

    if (operation.kind === "count" || operation.kind === "exists") {
        let inner =
            "select 1" +
            compileFromClause(operation.table, operation.joins, context) +
            compileWhereClause(operation.where, context) +
            compileGroupByClause(operation.groupBy, context) +
            compileHavingClause(operation.having, context);

        return {
            text:
                "select count(*) as " +
                quoteIdentifier("count") +
                " from (" +
                inner +
                ") as " +
                quoteIdentifier("__dt_count"),
            values,
        };
    }

    if (operation.kind === "insert") {
        return compileInsertOperation(operation, [operation.values], context);
    }

    if (operation.kind === "insertMany") {
        if (operation.values.length === 0) {
            return { text: "select 0 where 1 = 0", values };
        }

        return compileInsertOperation(operation, operation.values, context);
    }

    if (operation.kind === "update") {
        return {
            text:
                "update " +
                quote(getTableName(operation.table)) +
                " set " +
                Object.keys(operation.changes)
                    .map(
                        column =>
                            quote(column) + " = " + context.bindValue(operation.changes[column]),
                    )
                    .join(", ") +
                compileWhereClause(operation.where, context) +
                compileReturningClause(operation.returning, context),
            values,
        };
    }

    if (operation.kind === "delete") {
        return {
            text:
                "delete from " +
                quote(getTableName(operation.table)) +
                compileWhereClause(operation.where, context) +
                compileReturningClause(operation.returning, context),
            values,
        };
    }

    if (operation.kind === "upsert") {
        return compileUpsertOperation(operation, context);
    }

    throw new Error("Unsupported operation kind");
}

function compileInsertOperation(
    operation: InsertOperation,
    rows: Record<string, unknown>[],
    context: CompileContext,
): SqlStatement {
    let table = quote(getTableName(operation.table));
    let columns = collectColumns(rows);

    if (columns.length === 0) {
        return {
            text:
                "insert into " +
                table +
                " default values" +
                compileReturningClause(operation.returning, context),
            values: context.values,
        };
    }

    let valueSets = rows.map(
        row =>
            "(" +
            columns
                .map(column =>
                    context.bindValue(
                        Object.prototype.hasOwnProperty.call(row, column) ? row[column] : null,
                    ),
                )
                .join(", ") +
            ")",
    );

    return {
        text:
            "insert into " +
            table +
            " (" +
            columns.map(quote).join(", ") +
            ") values " +
            valueSets.join(", ") +
            compileReturningClause(operation.returning, context),
        values: context.values,
    };
}

function compileUpsertOperation(operation: UpsertOperation, context: CompileContext): SqlStatement {
    let insertColumns = Object.keys(operation.values);

    if (insertColumns.length === 0) {
        throw new Error("upsert requires at least one value");
    }

    let insertPlaceholders = insertColumns.map(column =>
        context.bindValue(operation.values[column]),
    );

    let conflictTarget = operation.conflictTarget ?? [...getTablePrimaryKey(operation.table)];
    let updateValues = operation.update ?? operation.values;
    let updateColumns = Object.keys(updateValues);

    let conflictClause =
        " on conflict (" +
        conflictTarget.map(quote).join(", ") +
        ")" +
        (updateColumns.length === 0
            ? " do nothing"
            : " do update set " +
              updateColumns
                  .map(column => quote(column) + " = " + context.bindValue(updateValues[column]))
                  .join(", "));

    return {
        text:
            "insert into " +
            quote(getTableName(operation.table)) +
            " (" +
            insertColumns.map(quote).join(", ") +
            ") values (" +
            insertPlaceholders.join(", ") +
            ")" +
            conflictClause +
            compileReturningClause(operation.returning, context),
        values: context.values,
    };
}
