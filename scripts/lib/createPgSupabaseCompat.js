function quoteIdentifier(value) {
  return `"${String(value || "").replace(/"/g, "\"\"")}"`;
}

function splitColumns(value) {
  return String(value || "")
    .split(",")
    .map((columnName) => columnName.trim())
    .filter(Boolean);
}

class QueryBuilder {
  constructor(client, tableName) {
    this.client = client;
    this.tableName = tableName;
    this.columns = ["*"];
    this.limitCount = 1;
  }

  select(columns) {
    this.columns = splitColumns(columns);
    return this;
  }

  limit(count) {
    this.limitCount = Number(count || 1);
    return this.#execute();
  }

  then(resolve, reject) {
    return Promise.resolve(this.#execute()).then(resolve, reject);
  }

  async #execute() {
    const selectedColumns = this.columns.length
      ? this.columns.map((columnName) => (columnName === "*" ? "*" : quoteIdentifier(columnName))).join(", ")
      : "*";

    try {
      const result = await this.client.query(
        `select ${selectedColumns} from public.${quoteIdentifier(this.tableName)} limit ${Number.isFinite(this.limitCount) ? this.limitCount : 1}`
      );

      return {
        data: result.rows,
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: {
          code: error.code || "",
          message: error.message || "Unknown Postgres error",
        },
      };
    }
  }
}

export function createPgSupabaseCompat(client) {
  return {
    from(tableName) {
      return new QueryBuilder(client, tableName);
    },
  };
}
