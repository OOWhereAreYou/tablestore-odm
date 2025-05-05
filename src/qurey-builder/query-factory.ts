// src/query-builder/query-factory.ts
import * as Tablestore from 'tablestore';

import { BaseZod, DbSchema } from '../schema';

export type SearchQuery = {
  query: Tablestore.SearchParams["searchQuery"]["query"];
  collapse?: {
    fieldName: string;
  };
} & Partial<Tablestore.SearchParams["searchQuery"]>;

export class QueryFactory {
  constructor() {}

  /**
   * 创建 MatchAllQuery (匹配所有文档)
   */
  public matchAll(): SearchQuery {
    return {
      query: { queryType: Tablestore.QueryType.MATCH_ALL_QUERY },
    };
  }
  /**
   * 创建 TermQuery (精确匹配，不分词)
   * @param field 字段名
   * @param term 要匹配的值 (字符串、数字、布尔)
   */
  public term(field: string, term: string | number | boolean): SearchQuery {
    return {
      query: {
        queryType: Tablestore.QueryType.TERM_QUERY,
        query: {
          fieldName: field,
          term: term,
        },
      },
    };
  }

  /**
   * 创建 TermsQuery (精确匹配多个值中的任意一个)
   * @param field 字段名
   * @param terms 要匹配的值数组
   */
  public terms(field: string, terms: string[]): SearchQuery {
    return {
      query: {
        queryType: Tablestore.QueryType.TERMS_QUERY,
        query: {
          fieldName: field,
          terms,
        },
      },
    };
  }

  /**
   * 创建 PrefixQuery (前缀匹配)
   * @param field 字段名
   * @param prefix 前缀字符串
   */
  public prefix(field: string, prefix: string): SearchQuery {
    return {
      query: {
        queryType: Tablestore.QueryType.PREFIX_QUERY,
        query: {
          fieldName: field,
          prefix,
        },
      },
    };
  }

  /**
   * 创建 RangeQuery (范围查询)
   * @param field 字段名
   * @param options 范围选项
   */
  public range(
    field: string,
    from: string | number,
    to: string | number,
    options: { includeLower?: boolean; includeUpper?: boolean } = {}
  ): SearchQuery {
    return {
      query: {
        queryType: Tablestore.QueryType.RANGE_QUERY,
        query: {
          fieldName: field,
          rangeFrom: from,
          rangeTo: to,
          includeLower: options.includeUpper ?? true,
          includeUpper: options.includeUpper ?? true,
        },
      },
    };
  }

  /**
   * 创建 WildcardQuery (通配符查询, * 匹配零或多个字符, ? 匹配单个字符)
   * @param field 字段名
   * @param value 通配符表达式
   */
  public wildcard(field: string, value: string): SearchQuery {
    return {
      query: {
        queryType: Tablestore.QueryType.WILDCARD_QUERY,
        query: {
          fieldName: field,
          value,
        },
      },
    };
  }

  /**
   * 创建 列存在性查询 (查询指定列是否存在)
   * @param field 字段名
   */
  public exists(field: string): SearchQuery {
    return {
      query: {
        queryType: Tablestore.QueryType.EXISTS_QUERY,
        query: {
          field,
        },
      },
    };
  }

  /**
   * 创建 折叠
   */
  public collapse(filed: string): SearchQuery {
    return {
      query: {
        queryType: Tablestore.QueryType.MATCH_ALL_QUERY,
      },
      collapse: {
        fieldName: filed,
      },
    };
  }
  /**
   * 创建 地理位置查询 (查询指定字段的地理位置信息)
   * @param field 字段名
   * @param points   地理位置数组
   */
  public geo(field: string, points: string[]): SearchQuery {
    return {
      query: {
        queryType: Tablestore.QueryType.GEO_DISTANCE_QUERY,
        query: {
          fieldName: field,
          points,
        },
      },
    };
  }

  /**
   * 创建 MatchQuery (全文匹配，会对查询文本进行分词)
   * @param field 字段名
   * @param text 查询文本
   * @param minimumShouldMatch 可选，最小匹配词项数
   * @param operator 可选，词项间的逻辑关系 (OR 或 AND)
   */
  public match(
    field: string,
    text: string,
    options: { minimumShouldMatch?: number; operator?: "OR" | "AND" } = {}
  ): SearchQuery {
    return {
      query: {
        queryType: Tablestore.QueryType.MATCH_QUERY,
        query: {
          fieldName: field,
          text,
          minimumShouldMatch: options.minimumShouldMatch ?? 1,
          operator: options.operator ?? "OR",
        },
      },
    };
  }

  /**
   * 创建 MatchPhraseQuery (短语匹配，查询文本作为一个整体匹配)
   * @param field 字段名
   * @param text 查询短语
   */
  public matchPhrase(field: string, text: string): SearchQuery {
    return {
      query: {
        queryType: Tablestore.QueryType.MATCH_PHRASE_QUERY,
        query: {
          fieldName: field,
          text,
        },
      },
    };
  }

  /**
   * 创建 BoolQuery (布尔组合查询)
   * @param options 布尔子句
   */
  public bool() {
    return {};
  }
}
