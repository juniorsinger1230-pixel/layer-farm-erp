/* GENERATED FROM APPROVED DB-A2/DB-A3 MODELS. */
export interface ColumnCatalog { name: string; type: string; nullable: boolean; identity: boolean; actorContext: boolean; hasDatabaseDefault: boolean; description: string; sensitivity: string }
export interface TableCatalog { tableName: string; tableId: string; moduleCode: string; tableKind: string; companyScope: boolean; chineseName: string; primaryKey: string[]; columns: ColumnCatalog[] }
export const schemaCatalog = [
  {
    "tableName": "company",
    "tableId": "TBL-DREQ-ORG-001",
    "moduleCode": "ORG",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "公司法人主体",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "公司代码(THL/TGE)",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_name",
        "type": "VARCHAR(100)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "公司全称",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "base_currency",
        "type": "CHAR(3)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "本位币",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "status",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "状态",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "organization_unit",
    "tableId": "TBL-DREQ-ORG-002",
    "moduleCode": "ORG",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "组织部门与层级",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "unit_code",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "部门编码",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "unit_name",
        "type": "VARCHAR(100)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "部门名称",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "parent_unit_id",
        "type": "BIGINT",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "上级部门",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "org_level",
        "type": "INTEGER",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "层级",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "status",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "状态",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "position",
    "tableId": "TBL-DREQ-ORG-003",
    "moduleCode": "ORG",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "岗位编制",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "position_code",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "岗位编码",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "position_name",
        "type": "VARCHAR(100)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "岗位名称",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "unit_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属部门",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "headcount",
        "type": "NUMERIC(12,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "编制人数",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "reports_to_id",
        "type": "BIGINT",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "汇报岗位",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "effective_date",
        "type": "DATE",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "生效日期",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "status",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "生效状态",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "employee",
    "tableId": "TBL-DREQ-ORG-004",
    "moduleCode": "ORG",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "员工档案",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "RESTRICTED_HR"
      },
      {
        "name": "employee_no",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "员工编号",
        "sensitivity": "RESTRICTED_HR"
      },
      {
        "name": "employee_name",
        "type": "VARCHAR(100)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "员工姓名",
        "sensitivity": "RESTRICTED_HR"
      },
      {
        "name": "position_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "岗位",
        "sensitivity": "RESTRICTED_HR"
      },
      {
        "name": "account",
        "type": "NUMERIC(12,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "登录账号",
        "sensitivity": "RESTRICTED_HR"
      },
      {
        "name": "employment_status",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "在职状态",
        "sensitivity": "RESTRICTED_HR"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "RESTRICTED_HR"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "RESTRICTED_HR"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "RESTRICTED_HR"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "RESTRICTED_HR"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "RESTRICTED_HR"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "RESTRICTED_HR"
      }
    ]
  },
  {
    "tableName": "system_role",
    "tableId": "TBL-DREQ-ORG-005",
    "moduleCode": "ORG",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "系统角色目录",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "role_code",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "角色编码",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "role_name",
        "type": "VARCHAR(100)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "角色名称",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "role_status",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "角色状态",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "position_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "映射岗位",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "data_permission",
    "tableId": "TBL-DREQ-ORG-006",
    "moduleCode": "ORG",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "授权与数据范围",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "role_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "系统角色",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "employee_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "被授权员工",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "module",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "模块",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "公司范围",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "house_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "栋舍范围",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "warehouse_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "仓库范围",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "task_ref",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "任务范围",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "valid_until",
        "type": "DATE",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "有效期至",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "approval_status",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "审批状态",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "farm_batch",
    "tableId": "TBL-DREQ-FARM-001",
    "moduleCode": "FARM",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "养殖批次",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "batch_no",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "批次号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "breed",
        "type": "VARCHAR(100)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "品种",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "source",
        "type": "VARCHAR(255)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "来源",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "chick_date",
        "type": "DATE",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "进雏日期",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "initial_quantity",
        "type": "NUMERIC(12,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "基础数量(只)",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "day_age",
        "type": "INTEGER",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "日龄",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "stage",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "阶段",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "house_pen",
    "tableId": "TBL-DREQ-FARM-002",
    "moduleCode": "FARM",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "栋舍栏位",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "house_code",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "栋舍编码",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "house_name",
        "type": "VARCHAR(100)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "栋舍名称",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "pen_count",
        "type": "NUMERIC(12,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "栏位数",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "floor_count",
        "type": "NUMERIC(12,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "层数",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "farm_mode",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "养殖模式",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "house_status",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "栋舍状态",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "chick_receipt",
    "tableId": "TBL-DREQ-FARM-003",
    "moduleCode": "FARM",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "进雏验收记录",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "batch_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "养殖批次",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "count_quantity",
        "type": "NUMERIC(12,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "点数(只)",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "avg_weight",
        "type": "NUMERIC(10,3)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "均重",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "qualified",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "合格判定",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "gifted_quantity",
        "type": "NUMERIC(12,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "赠送数量(只)",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "reject_or_quarantine",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "拒收或隔离",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "feeding_record",
    "tableId": "TBL-DREQ-FARM-004",
    "moduleCode": "FARM",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "饲喂记录",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "batch_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "养殖批次",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "first_drink_feed",
        "type": "NUMERIC(14,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "初饮开食",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "daily_feeding",
        "type": "NUMERIC(14,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "日饲喂量",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "material_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "物料",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "quantity",
        "type": "NUMERIC(12,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "数量",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "intake_check",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "采食检查",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "environment_record",
    "tableId": "TBL-DREQ-FARM-005",
    "moduleCode": "FARM",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "环境记录",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "batch_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "养殖批次",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "house_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "栋舍",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "shift",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "班次",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "temperature",
        "type": "NUMERIC(6,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "温度",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "humidity",
        "type": "NUMERIC(6,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "湿度",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "ventilation",
        "type": "NUMERIC(10,2)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "通风",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "threshold",
        "type": "NUMERIC(14,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "阈值",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "action_alert",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "处置和预警",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "beak_trimming_record",
    "tableId": "TBL-DREQ-FARM-006",
    "moduleCode": "FARM",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "断喙记录",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "batch_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "养殖批次",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "operation_date",
        "type": "DATE",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "执行日期",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "executed",
        "type": "BOOLEAN",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "是否执行",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "hemostasis",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "止血处理",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "observation",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "观察情况",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "has_exception",
        "type": "BOOLEAN",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "是否异常",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "weighing_record",
    "tableId": "TBL-DREQ-FARM-007",
    "moduleCode": "FARM",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "称重与均匀度",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "batch_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "养殖批次",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "sample_size",
        "type": "NUMERIC(12,0)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "抽样数量(只)",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "avg_weight",
        "type": "NUMERIC(10,3)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "均重",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "uniformity",
        "type": "NUMERIC(6,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "均匀度(%)",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "feeding_group_advice",
        "type": "NUMERIC(14,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "调料或分群建议",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "transfer_record",
    "tableId": "TBL-DREQ-FARM-008",
    "moduleCode": "FARM",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "转群记录",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "batch_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "养殖批次",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "from_house_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "原栋舍",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "to_house_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "目标栋舍",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "fasting",
        "type": "BOOLEAN",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "是否空腹",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "headcount_check",
        "type": "NUMERIC(12,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "清点数量(只)",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "anti_stress",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "抗应激处理",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "location_change",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "位置变更",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "mortality_cull_record",
    "tableId": "TBL-DREQ-FARM-009",
    "moduleCode": "FARM",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "死淘与淘汰",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "batch_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "养殖批次",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "mortality_reason",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "死淘原因",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "quantity",
        "type": "NUMERIC(12,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "数量(只)",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "cull_decision",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "淘汰决策",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "harmless_treatment",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "无害化处理",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "stock_update",
        "type": "NUMERIC(12,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "存栏更新(只)",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "vaccination_program",
    "tableId": "TBL-DREQ-VET-001",
    "moduleCode": "VET",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "免疫程序",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "program_code",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "程序编码",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "program_name",
        "type": "VARCHAR(100)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "程序名称",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "program_type",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "程序类型",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "version",
        "type": "VARCHAR(20)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "版本",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "applicable_scope",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "适用范围",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "effective_date",
        "type": "DATE",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "生效日期",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "vaccination_task",
    "tableId": "TBL-DREQ-VET-002",
    "moduleCode": "VET",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "免疫任务",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "program_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "免疫程序",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "batch_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "养殖批次",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "day_age",
        "type": "INTEGER",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "日龄/周龄",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "vaccine_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "疫苗",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "route",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "路径",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "house_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "栋舍",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "owner_employee_no",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "责任人",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "vaccination_execution",
    "tableId": "TBL-DREQ-VET-003",
    "moduleCode": "VET",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "免疫执行记录",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "task_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "免疫任务",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "planned_day_age",
        "type": "INTEGER",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "计划日龄",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "actual_day_age",
        "type": "INTEGER",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "实际日龄",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "lot_no",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "疫苗批号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "dosage",
        "type": "NUMERIC(10,3)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "剂量",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "stock_quantity",
        "type": "NUMERIC(12,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "存栏(只)",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "has_exception",
        "type": "BOOLEAN",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "是否异常",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "vaccine_requisition",
    "tableId": "TBL-DREQ-VET-004",
    "moduleCode": "VET",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "疫苗领用",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "execution_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "免疫执行",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "vaccine_lot_no",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "疫苗批号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "requisition_quantity",
        "type": "NUMERIC(12,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "领用量",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "stock_deduction",
        "type": "NUMERIC(12,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "库存扣减",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "shortage_alert",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "不足预警",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "medication_prescription",
    "tableId": "TBL-DREQ-VET-005",
    "moduleCode": "VET",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "用药处方",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "batch_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "养殖批次",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "drug_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "药品",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "usage_dosage",
        "type": "NUMERIC(10,3)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "用法用量",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "approval_status",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "审批状态",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "executed",
        "type": "BOOLEAN",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "是否执行",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "exception_feedback",
        "type": "NUMERIC(14,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "异常反馈",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "withdrawal_period_record",
    "tableId": "TBL-DREQ-VET-006",
    "moduleCode": "VET",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "休药期记录",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "prescription_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "用药处方",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "medication_event",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "用药事件",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "withdrawal_days",
        "type": "INTEGER",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "休药期(天)",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "sale_block_alert",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "禁售预警",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "release_status",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "解除状态",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "quarantine_certificate",
    "tableId": "TBL-DREQ-VET-007",
    "moduleCode": "VET",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "检疫证",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "cert_no",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "检疫证编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "cert_type",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "证型",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "request_status",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "申请状态",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "issue_status",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "出证状态",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "accompany_doc",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "随货同行",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "archived",
        "type": "BOOLEAN",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "是否归档",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "purchase_requisition",
    "tableId": "TBL-DREQ-PROC-001",
    "moduleCode": "PROC",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "采购申请",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "requisition_no",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "采购申请单号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "demand_source",
        "type": "VARCHAR(255)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "需求来源",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "material_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "物料",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "quantity",
        "type": "NUMERIC(12,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "数量",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "purpose",
        "type": "VARCHAR(255)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "用途",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "approval_status",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "审批状态",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "purchase_order",
    "tableId": "TBL-DREQ-PROC-002",
    "moduleCode": "PROC",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "采购订单",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "order_no",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "采购订单号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "supplier_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "供应商",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "material_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "物料",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "quantity",
        "type": "NUMERIC(12,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "数量",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "price",
        "type": "NUMERIC(14,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "单价",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "change_log",
        "type": "VARCHAR(1000)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "变更记录",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "execution_close",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "执行和关闭",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "supplier",
    "tableId": "TBL-DREQ-PROC-003",
    "moduleCode": "PROC",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "供应商",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "supplier_code",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "供应商编码",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "supplier_name",
        "type": "VARCHAR(100)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "供应商名称",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "material_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "可供物料",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "contact_person",
        "type": "VARCHAR(50)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "联系人",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "qualification",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "资质",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "brand",
        "type": "VARCHAR(100)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "品牌",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "status",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "状态",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "goods_receipt",
    "tableId": "TBL-DREQ-PROC-004",
    "moduleCode": "PROC",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "到货验收",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "receipt_no",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "验收单号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "order_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "采购订单",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "order_check",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "订单核对",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "quantity",
        "type": "NUMERIC(12,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "数量",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "spec",
        "type": "VARCHAR(100)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "规格",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "quality_status",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "质量",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "difference",
        "type": "NUMERIC(12,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "差异",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "material",
    "tableId": "TBL-DREQ-INV-001",
    "moduleCode": "INV",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "物料主数据",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "material_code",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "物料编码",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "material_name",
        "type": "VARCHAR(100)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "物料名称",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "category",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "分类",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "pack_uom",
        "type": "VARCHAR(100)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "包装规格",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "uom",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "计量单位",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "inventory_ledger",
    "tableId": "TBL-DREQ-INV-002",
    "moduleCode": "INV",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "库存台账",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "material_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "物料",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "batch_no",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "批次号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "location_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "库位",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "warehouse_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "仓库",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "quantity",
        "type": "NUMERIC(12,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "数量",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "inventory_status",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "库存状态",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "inbound_record",
    "tableId": "TBL-DREQ-INV-003",
    "moduleCode": "INV",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "入库记录",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "inbound_no",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "入库单号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "inbound_type",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "入库类型",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "purchase_arrival",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "采购到货",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "egg_quantity",
        "type": "NUMERIC(12,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "成品蛋数量",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "validation",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "校验结果",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "putaway",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "上架信息",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "outbound_record",
    "tableId": "TBL-DREQ-INV-004",
    "moduleCode": "INV",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "出库记录",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "outbound_no",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "出库单号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "outbound_type",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "出库类型",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "sales_ref",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "销售订单",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "requisition_ref",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "领用单",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "transfer_ref",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "调拨单",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "return_ref",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "退货单",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "task_driven_ref",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "任务驱动",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "warehouse_location",
    "tableId": "TBL-DREQ-INV-005",
    "moduleCode": "INV",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "仓库与库位",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "warehouse_code",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "仓库编码",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "warehouse_name",
        "type": "VARCHAR(100)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "仓库名称",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "location_code",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "库位编码",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "stocktake_record",
    "tableId": "TBL-DREQ-INV-006",
    "moduleCode": "INV",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "盘点记录",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "stocktake_no",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "盘点单号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "book_quantity",
        "type": "NUMERIC(12,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "账面数",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "actual_quantity",
        "type": "NUMERIC(12,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "实盘数",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "difference",
        "type": "NUMERIC(12,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "差异",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "adjustment",
        "type": "NUMERIC(12,2)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "调整数",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "approval_status",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "审批状态",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "batch_expiry",
    "tableId": "TBL-DREQ-INV-007",
    "moduleCode": "INV",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "批次效期与FEFO",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "material_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "物料",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "batch_no",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "批号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "production_date",
        "type": "DATE",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "生产日期",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "expiry_date",
        "type": "DATE",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "有效期",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "near_expiry_alert",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "临期预警",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "batch_status",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "批次状态",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "safety_stock",
    "tableId": "TBL-DREQ-INV-008",
    "moduleCode": "INV",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "安全库存",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "material_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "物料",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "threshold_value",
        "type": "NUMERIC(14,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "安全库存阈值",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "replenish_request",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "补库申请",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "notification",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "通知",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "process_status",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "处理状态",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "customer",
    "tableId": "TBL-DREQ-SALES-001",
    "moduleCode": "SALES",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "客户",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "customer_code",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "客户编码",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "customer_name",
        "type": "VARCHAR(100)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "客户名称",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "contact_person",
        "type": "VARCHAR(50)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "联系人",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "address",
        "type": "VARCHAR(255)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "地址",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "payment_term",
        "type": "INTEGER",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "账期(天)",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "credit_ref",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "信用额度",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "price_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "适用价格",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "status",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "状态",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "RESTRICTED"
      }
    ]
  },
  {
    "tableName": "price_list",
    "tableId": "TBL-DREQ-SALES-002",
    "moduleCode": "SALES",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "价格",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "price_list_code",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "价目编码",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "price_type",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "价格类型",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "product_name",
        "type": "VARCHAR(100)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "项目名称",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "price",
        "type": "NUMERIC(14,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "价格",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "effective_rule",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "生效规则",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "effective_date",
        "type": "DATE",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "生效日期",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "RESTRICTED"
      }
    ]
  },
  {
    "tableName": "sales_order",
    "tableId": "TBL-DREQ-SALES-003",
    "moduleCode": "SALES",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "销售订单",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "order_no",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "销售订单号",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "customer_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "客户",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "order_mode",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "批量/散货",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "detail",
        "type": "VARCHAR(2000)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "明细",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "pricing",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "取价",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "inventory_quantity",
        "type": "NUMERIC(12,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "库存校验",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "status",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "状态",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "change_log",
        "type": "VARCHAR(1000)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "变更",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "RESTRICTED"
      }
    ]
  },
  {
    "tableName": "credit_limit",
    "tableId": "TBL-DREQ-SALES-004",
    "moduleCode": "SALES",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "信用额度",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "customer_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "客户",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "credit_amount",
        "type": "NUMERIC(14,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "信用额度",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "occupied_amount",
        "type": "NUMERIC(14,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "已占用",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "over_limit_block",
        "type": "BOOLEAN",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "超额拦截",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "manual_adjust",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "界面调整",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "ceo_approval",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "CEO审批",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "RESTRICTED"
      }
    ]
  },
  {
    "tableName": "payment_term_exception",
    "tableId": "TBL-DREQ-SALES-005",
    "moduleCode": "SALES",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "账期与例外放行",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "customer_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "客户",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "payment_term",
        "type": "INTEGER",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "账期(天)",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "threshold_value",
        "type": "NUMERIC(14,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "阈值",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "exception_reason",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "例外原因",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "approval_audit",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "审批和审计",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "RESTRICTED"
      }
    ]
  },
  {
    "tableName": "delivery_task",
    "tableId": "TBL-DREQ-LOG-001",
    "moduleCode": "LOG",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "配送任务",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "task_no",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "配送任务号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "order_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "销售订单",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "cargo",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "货物",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "vehicle_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "车辆",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "route_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "路线",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "driver_no",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "司机",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "courier_no",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "配送员",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "vehicle_route",
    "tableId": "TBL-DREQ-LOG-002",
    "moduleCode": "LOG",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "车辆与路线",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "vehicle_code",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "车辆编码",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "route_code",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "路线编码",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "customer_sequence",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "客户顺序",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "ship_time",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "发运时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "delivery_receipt",
    "tableId": "TBL-DREQ-LOG-003",
    "moduleCode": "LOG",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "签收回单",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "task_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "配送任务",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "customer_sign",
        "type": "BOOLEAN",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "客户签收",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "receipt_doc",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "回单",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "photo_ref",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "照片",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "has_exception",
        "type": "BOOLEAN",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "异常",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "archived",
        "type": "BOOLEAN",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "是否归档",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "delivery_exception",
    "tableId": "TBL-DREQ-LOG-004",
    "moduleCode": "LOG",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "拒收与配送异常",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "task_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "配送任务",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "exception_type",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "异常类型",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "reason",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "原因",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "photo_ref",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "照片和处置",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "receivable",
    "tableId": "TBL-DREQ-FIN-001",
    "moduleCode": "FIN",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "应收账款",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "order_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "销售订单",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "signed",
        "type": "BOOLEAN",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "签收依据",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "payment_term",
        "type": "INTEGER",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "账期(天)",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "receivable_balance",
        "type": "NUMERIC(14,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "应收余额",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "overdue",
        "type": "BOOLEAN",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "是否逾期",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      }
    ]
  },
  {
    "tableName": "receipt_record",
    "tableId": "TBL-DREQ-FIN-002",
    "moduleCode": "FIN",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "收款记录",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "receivable_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "应收账款",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "receipt_method",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "收款方式",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "cash_amount",
        "type": "NUMERIC(14,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "现金",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "check_amount",
        "type": "NUMERIC(14,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "支票",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "bank_credit",
        "type": "NUMERIC(14,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "银行入账",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "writeoff",
        "type": "NUMERIC(14,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "核销金额",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "overpay_balance",
        "type": "NUMERIC(14,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "溢付/余额",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      }
    ]
  },
  {
    "tableName": "cash_checkbook",
    "tableId": "TBL-DREQ-FIN-003",
    "moduleCode": "FIN",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "现金/支票簿",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "check_no",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "支票号",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "payment_info",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "付款信息",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "cash_amount",
        "type": "NUMERIC(14,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "现金",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "signature",
        "type": "VARCHAR(100)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "签字",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "bank_fields",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "银行字段",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "voucher_id",
        "type": "BIGINT",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "付款凭证",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "account_title",
        "type": "VARCHAR(120)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "账户名称",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "bank_name",
        "type": "VARCHAR(120)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "银行",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "check_date",
        "type": "DATE",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "支票日期",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "payee_name",
        "type": "VARCHAR(120)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "收款人",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "payee_address",
        "type": "VARCHAR(255)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "收款人地址",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "payment_execution_status",
        "type": "VARCHAR(48)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "付款执行状态",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "received_payment_by",
        "type": "VARCHAR(120)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "收款签收人",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      }
    ]
  },
  {
    "tableName": "payable",
    "tableId": "TBL-DREQ-FIN-004",
    "moduleCode": "FIN",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "应付账款",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "purchase_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "采购订单",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "acceptance",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "验收依据",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "invoice_ref",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "发票",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "payable_balance",
        "type": "NUMERIC(14,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "应付余额",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "payment_term",
        "type": "INTEGER",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "账期(天)",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "goods_receipt_id",
        "type": "BIGINT",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "验收单",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "withholding_tax_amount",
        "type": "NUMERIC(14,2)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "预提税金额",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "voucher_status",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "凭证状态",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      }
    ]
  },
  {
    "tableName": "payment_record",
    "tableId": "TBL-DREQ-FIN-005",
    "moduleCode": "FIN",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "付款记录",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "payment_request",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "付款申请",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "check_amount",
        "type": "NUMERIC(14,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "支票",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "bank_ref",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "银行",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "approval_status",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "审批状态",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "writeoff",
        "type": "NUMERIC(14,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "核销金额",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "voucher_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "DV/CV凭证",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "planned_payment_method",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "计划支付方式",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "payment_execution_status",
        "type": "VARCHAR(48)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "实际付款执行状态",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "cashier_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "出纳员工",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "check_issue_date",
        "type": "DATE",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "支票签发日期",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "bank_transfer_ref",
        "type": "VARCHAR(64)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "银行转账参考号",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "transfer_initiated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "转账发起时间",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "cash_paid_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "现金支付时间",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "executed_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "付款执行时间",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "payment_evidence_id",
        "type": "BIGINT",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "付款证据附件",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      }
    ]
  },
  {
    "tableName": "cost_allocation",
    "tableId": "TBL-DREQ-FIN-006",
    "moduleCode": "FIN",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "成本与薪酬分摊",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "batch_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "归集批次",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "shared_position",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "共用岗位",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "attendance",
        "type": "NUMERIC(8,2)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "考勤",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "task_ref",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "任务",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "salary",
        "type": "NUMERIC(14,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "薪资",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "expense_account",
        "type": "NUMERIC(12,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "费用和科目",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      }
    ]
  },
  {
    "tableName": "disbursement_voucher",
    "tableId": "TBL-DREQ-FIN-007",
    "moduleCode": "FIN",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "付款凭证（DV/CV）",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "voucher_no",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "凭证编号",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "voucher_type",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "凭证类型",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "planned_payment_method",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "计划支付方式",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "payable_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "应付账款",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "supplier_id",
        "type": "BIGINT",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "供应商",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "invoice_refs",
        "type": "VARCHAR(500)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "发票引用",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "receiving_refs",
        "type": "VARCHAR(500)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "验收单引用",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "particulars",
        "type": "VARCHAR(1000)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "用途说明",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "gross_amount",
        "type": "NUMERIC(14,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "总额",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "withholding_tax_amount",
        "type": "NUMERIC(14,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "预提税金额",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "net_disbursement_amount",
        "type": "NUMERIC(14,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "净付款金额",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "accounting_entry_ref",
        "type": "VARCHAR(120)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "会计分录引用",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "prepared_by",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "制证会计",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "prepared_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "制证时间",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "approval_status",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "审批状态",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "approved_by",
        "type": "BIGINT",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "审批人",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "approved_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "审批时间",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      }
    ]
  },
  {
    "tableName": "equipment",
    "tableId": "TBL-DREQ-EQP-001",
    "moduleCode": "EQP",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "设备台账",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "equipment_code",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "设备编码",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "equipment_name",
        "type": "VARCHAR(100)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "设备名称",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "equipment_type",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "设备类型",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "house_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所在栋舍",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "equipment_check",
    "tableId": "TBL-DREQ-EQP-002",
    "moduleCode": "EQP",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "点检记录",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "equipment_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "设备",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "check_standard",
        "type": "NUMERIC(14,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "点检标准",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "result",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "结果",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "issues",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "问题",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "blocking_item",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "阻断项",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "maintenance_work_order",
    "tableId": "TBL-DREQ-EQP-003",
    "moduleCode": "EQP",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "维修工单",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "equipment_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "设备",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "fault",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "故障描述",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "repair",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "维修内容",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "spare_part_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备件",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "work_hours",
        "type": "NUMERIC(12,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "工时",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "acceptance_close",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "验收和关闭",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "spare_part",
    "tableId": "TBL-DREQ-EQP-004",
    "moduleCode": "EQP",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "备件",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "spare_part_code",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备件编码",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "spare_part_name",
        "type": "VARCHAR(100)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备件名称",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "inventory_quantity",
        "type": "NUMERIC(12,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "库存",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "requisition_ref",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "领用",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "inventory_sync",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "库存联动",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "metric_definition",
    "tableId": "TBL-DREQ-RPT-001",
    "moduleCode": "RPT",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "指标口径",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "metric_code",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "指标编码",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "metric_name",
        "type": "VARCHAR(100)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "指标定义",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "calc_definition",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "计算口径",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "confirmer",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "确认人",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "version",
        "type": "VARCHAR(20)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "版本",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "report_record",
    "tableId": "TBL-DREQ-RPT-002",
    "moduleCode": "RPT",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "报表记录",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "report_no",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "报表编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "report_type",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "报表类型",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "export_ref",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "导出文件",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "generation_condition",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "生成条件和人员",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "dashboard_snapshot",
    "tableId": "TBL-DREQ-RPT-003",
    "moduleCode": "RPT",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "看板快照",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "key_metric",
        "type": "VARCHAR(1000)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "关键指标",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "refresh_time",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "刷新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "data_snapshot",
        "type": "VARCHAR(2000)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "数据版本和快照",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "print_template",
    "tableId": "TBL-DREQ-PRINT-001",
    "moduleCode": "PRINT",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "打印模板",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "RESTRICTED_EVIDENCE"
      },
      {
        "name": "template_code",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "模板编码",
        "sensitivity": "RESTRICTED_EVIDENCE"
      },
      {
        "name": "template_name",
        "type": "VARCHAR(100)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "模板名称",
        "sensitivity": "RESTRICTED_EVIDENCE"
      },
      {
        "name": "template_type",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "模板类型",
        "sensitivity": "RESTRICTED_EVIDENCE"
      },
      {
        "name": "paper_spec",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "纸张规格",
        "sensitivity": "RESTRICTED_EVIDENCE"
      },
      {
        "name": "layout",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "版式",
        "sensitivity": "RESTRICTED_EVIDENCE"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "RESTRICTED_EVIDENCE"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "RESTRICTED_EVIDENCE"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "RESTRICTED_EVIDENCE"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "RESTRICTED_EVIDENCE"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "RESTRICTED_EVIDENCE"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "RESTRICTED_EVIDENCE"
      },
      {
        "name": "paper_size_code",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "纸张代码",
        "sensitivity": "RESTRICTED_EVIDENCE"
      },
      {
        "name": "paper_dimensions_mm",
        "type": "VARCHAR(64)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "纸张毫米尺寸",
        "sensitivity": "RESTRICTED_EVIDENCE"
      },
      {
        "name": "applicable_document_type",
        "type": "VARCHAR(64)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "适用单据类型",
        "sensitivity": "RESTRICTED_EVIDENCE"
      },
      {
        "name": "target_printer_models",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "目标打印设备",
        "sensitivity": "RESTRICTED_EVIDENCE"
      },
      {
        "name": "margin_config",
        "type": "JSONB",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "边距配置",
        "sensitivity": "RESTRICTED_EVIDENCE"
      }
    ]
  },
  {
    "tableName": "print_job",
    "tableId": "TBL-DREQ-PRINT-002",
    "moduleCode": "PRINT",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "打印任务",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "job_no",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "打印任务号",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "template_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "模板",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "pdf_ref",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "PDF文件",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "batch_print",
        "type": "BOOLEAN",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "是否批量",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "queue_status",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "队列状态",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "result",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "结果",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "printer_device_id",
        "type": "BIGINT",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "打印设备",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "paper_size_code",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "纸张代码",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "target_device_model",
        "type": "VARCHAR(64)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "目标设备型号",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "reprint_count",
        "type": "INTEGER",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "重打次数",
        "sensitivity": "RESTRICTED"
      }
    ]
  },
  {
    "tableName": "print_log",
    "tableId": "TBL-DREQ-PRINT-003",
    "moduleCode": "PRINT",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "打印日志",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "print_by",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "打印人",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "event_time",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "打印时间",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "doc_ref",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "单据",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "reprint",
        "type": "BOOLEAN",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "是否重打",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "void_status",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "作废状态",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "reason",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "作废原因",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "device_model",
        "type": "VARCHAR(64)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "设备型号",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "paper_size_code",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "纸张代码",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      }
    ]
  },
  {
    "tableName": "printer_device",
    "tableId": "TBL-DREQ-PRINT-004",
    "moduleCode": "PRINT",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "打印设备",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "device_code",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "设备编码",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "device_brand",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "品牌",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "device_model",
        "type": "VARCHAR(64)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "型号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "connection_type",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "连接方式",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "supported_paper",
        "type": "VARCHAR(255)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "支持纸张",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "device_status",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "设备状态",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "location",
        "type": "VARCHAR(120)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "安装位置",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "default_document_types",
        "type": "VARCHAR(255)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "默认单据类型",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "last_calibrated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最近校准时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "audit_log",
    "tableId": "TBL-DREQ-TRACE-001",
    "moduleCode": "TRACE",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "审计日志",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "employee_no",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "操作人",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "login_ref",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "登录信息",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "operation",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "操作",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "permission_ref",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "权限",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "sensitive_op",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "敏感操作和失败",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      }
    ]
  },
  {
    "tableName": "version_history",
    "tableId": "TBL-DREQ-TRACE-002",
    "moduleCode": "TRACE",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "版本历史",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "entity_ref",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "对象",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "before_value",
        "type": "VARCHAR(2000)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "变更前值",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "after_value",
        "type": "VARCHAR(2000)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "变更后值",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "employee_no",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "人员",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "time_reason",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "时间和原因",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      }
    ]
  },
  {
    "tableName": "traceability_link",
    "tableId": "TBL-DREQ-TRACE-003",
    "moduleCode": "TRACE",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "追溯链",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "batch_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "批次",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "house_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "栋舍",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "material_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "物料",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "vaccination_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "免疫",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "doc_ref",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "单据",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "drill_through",
        "type": "VARCHAR(1000)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "结果穿透",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "CONFIDENTIAL_AUDIT"
      }
    ]
  },
  {
    "tableName": "attachment",
    "tableId": "TBL-DREQ-PLAT-001",
    "moduleCode": "PLAT",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "附件资料",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "file_name",
        "type": "VARCHAR(100)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "文件名",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "file_type",
        "type": "VARCHAR(50)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "文件类型",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "file_path",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "存储路径",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "owner_ref",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "归属",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "permission_archive",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "权限和归档",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "RESTRICTED"
      }
    ]
  },
  {
    "tableName": "notification",
    "tableId": "TBL-DREQ-PLAT-002",
    "moduleCode": "PLAT",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "通知消息",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "notification_type",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "通知类型",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "title",
        "type": "VARCHAR(200)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "标题",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "content",
        "type": "VARCHAR(2000)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "内容",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "employee_no",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "接收人",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "read_status",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "已读状态",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "RESTRICTED"
      }
    ]
  },
  {
    "tableName": "term_enum",
    "tableId": "TBL-DREQ-PLAT-003",
    "moduleCode": "PLAT",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "术语与枚举",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "term_code",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "术语编码",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "term",
        "type": "VARCHAR(100)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "术语",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "enum_ref",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "枚举",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "currency",
        "type": "CHAR(3)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "币种",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "date_format",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "日期格式",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "number_format",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "数字格式和版本",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "offline_sync_record",
    "tableId": "TBL-DREQ-PLAT-004",
    "moduleCode": "PLAT",
    "tableKind": "BUSINESS_ENTITY",
    "companyScope": true,
    "chineseName": "离线同步记录",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "主键",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "local_id",
        "type": "VARCHAR(64)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "本地ID",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "cache_ref",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "缓存",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "sync_status",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "同步状态",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "conflict",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "冲突",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "resolution_deadline",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "裁定和时限",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "company_code",
        "type": "VARCHAR(16)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "所属公司",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "created_by",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": true,
        "hasDatabaseDefault": true,
        "description": "创建人员工编号",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "updated_by",
        "type": "VARCHAR(32)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新人员工编号",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最后更新时间",
        "sensitivity": "RESTRICTED"
      },
      {
        "name": "remark",
        "type": "VARCHAR(500)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "备注",
        "sensitivity": "RESTRICTED"
      }
    ]
  },
  {
    "tableName": "outbox_event",
    "tableId": "TBL-TDS-001",
    "moduleCode": "PLAT",
    "tableKind": "TECHNICAL",
    "companyScope": true,
    "chineseName": "事务 Outbox 事件",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "Outbox内部主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "公司上下文",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "event_id",
        "type": "UUID",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "事件全局唯一标识",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "aggregate_type",
        "type": "VARCHAR(100)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "聚合类型",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "aggregate_id",
        "type": "VARCHAR(100)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "聚合标识",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "event_type",
        "type": "VARCHAR(150)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "事件类型",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "event_version",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "事件版本",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "payload",
        "type": "JSONB",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "事件载荷",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "headers",
        "type": "JSONB",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "事件上下文头",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "occurred_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "事件发生时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "available_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "可投递时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "published_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "实际投递时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "publish_attempts",
        "type": "INTEGER",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "投递尝试次数",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "last_error",
        "type": "TEXT",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最近投递错误",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "记录创建时间",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "idempotency_consumption",
    "tableId": "TBL-TDS-002",
    "moduleCode": "PLAT",
    "tableKind": "TECHNICAL",
    "companyScope": true,
    "chineseName": "幂等消费记录",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "消费记录主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "公司上下文",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "consumer_name",
        "type": "VARCHAR(150)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "消费者名称",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "event_id",
        "type": "UUID",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "来源事件标识",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "idempotency_key",
        "type": "VARCHAR(200)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "消费幂等键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "request_hash",
        "type": "CHAR(64)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "请求内容哈希",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "processing_status",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "处理状态",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "result_payload",
        "type": "JSONB",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "原处理结果",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "first_received_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "首次接收时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "processed_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "完成处理时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "expires_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "记录到期时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "记录创建时间",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "task_status",
    "tableId": "TBL-TDS-003",
    "moduleCode": "PLAT",
    "tableKind": "TECHNICAL",
    "companyScope": true,
    "chineseName": "持久化任务状态",
    "primaryKey": [
      "id"
    ],
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "identity": true,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "任务状态主键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "company_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "公司上下文",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "task_id",
        "type": "UUID",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "任务全局标识",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "task_type",
        "type": "VARCHAR(100)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "任务类型",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "idempotency_key",
        "type": "VARCHAR(200)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "任务幂等键",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "status",
        "type": "VARCHAR(32)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "任务状态",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "progress_percent",
        "type": "NUMERIC(5,2)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "进度百分比",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "attempt_count",
        "type": "INTEGER",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "已尝试次数",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "max_attempts",
        "type": "INTEGER",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "最大尝试次数",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "payload",
        "type": "JSONB",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "任务输入",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "result_payload",
        "type": "JSONB",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "任务结果",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "error_code",
        "type": "VARCHAR(100)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "错误码",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "error_detail",
        "type": "TEXT",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "错误详情",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "worker_id",
        "type": "VARCHAR(150)",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "执行Worker标识",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "lease_until",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "租约到期时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "created_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "创建时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "started_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "开始时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "finished_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "结束时间",
        "sensitivity": "INTERNAL"
      },
      {
        "name": "updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "更新时间",
        "sensitivity": "INTERNAL"
      }
    ]
  },
  {
    "tableName": "rm_operational_dashboard",
    "tableId": "TBL-RDM-001",
    "moduleCode": "RPT",
    "tableKind": "READ_MODEL",
    "companyScope": true,
    "chineseName": "经营看板读模型",
    "primaryKey": [
      "company_id",
      "read_model_key"
    ],
    "columns": [
      {
        "name": "company_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "公司上下文",
        "sensitivity": "INHERIT_SOURCE_PENDING_REVIEW"
      },
      {
        "name": "read_model_key",
        "type": "VARCHAR(200)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "读模型业务/投影键",
        "sensitivity": "INHERIT_SOURCE_PENDING_REVIEW"
      },
      {
        "name": "source_event_version",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "来源事件版本",
        "sensitivity": "INHERIT_SOURCE_PENDING_REVIEW"
      },
      {
        "name": "source_updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "来源更新时间",
        "sensitivity": "INHERIT_SOURCE_PENDING_REVIEW"
      },
      {
        "name": "projection_payload",
        "type": "JSONB",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "投影内容",
        "sensitivity": "INHERIT_SOURCE_PENDING_REVIEW"
      },
      {
        "name": "projected_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "投影生成时间",
        "sensitivity": "INHERIT_SOURCE_PENDING_REVIEW"
      }
    ]
  },
  {
    "tableName": "rm_report_snapshot",
    "tableId": "TBL-RDM-002",
    "moduleCode": "RPT",
    "tableKind": "READ_MODEL",
    "companyScope": true,
    "chineseName": "报表快照读模型",
    "primaryKey": [
      "company_id",
      "read_model_key"
    ],
    "columns": [
      {
        "name": "company_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "公司上下文",
        "sensitivity": "INHERIT_SOURCE_PENDING_REVIEW"
      },
      {
        "name": "read_model_key",
        "type": "VARCHAR(200)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "读模型业务/投影键",
        "sensitivity": "INHERIT_SOURCE_PENDING_REVIEW"
      },
      {
        "name": "source_event_version",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "来源事件版本",
        "sensitivity": "INHERIT_SOURCE_PENDING_REVIEW"
      },
      {
        "name": "source_updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "来源更新时间",
        "sensitivity": "INHERIT_SOURCE_PENDING_REVIEW"
      },
      {
        "name": "projection_payload",
        "type": "JSONB",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "投影内容",
        "sensitivity": "INHERIT_SOURCE_PENDING_REVIEW"
      },
      {
        "name": "projected_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "投影生成时间",
        "sensitivity": "INHERIT_SOURCE_PENDING_REVIEW"
      }
    ]
  },
  {
    "tableName": "rm_traceability_projection",
    "tableId": "TBL-RDM-003",
    "moduleCode": "TRACE",
    "tableKind": "READ_MODEL",
    "companyScope": true,
    "chineseName": "追溯投影读模型",
    "primaryKey": [
      "company_id",
      "read_model_key"
    ],
    "columns": [
      {
        "name": "company_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "公司上下文",
        "sensitivity": "INHERIT_SOURCE_PENDING_REVIEW"
      },
      {
        "name": "read_model_key",
        "type": "VARCHAR(200)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "读模型业务/投影键",
        "sensitivity": "INHERIT_SOURCE_PENDING_REVIEW"
      },
      {
        "name": "source_event_version",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "来源事件版本",
        "sensitivity": "INHERIT_SOURCE_PENDING_REVIEW"
      },
      {
        "name": "source_updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "来源更新时间",
        "sensitivity": "INHERIT_SOURCE_PENDING_REVIEW"
      },
      {
        "name": "projection_payload",
        "type": "JSONB",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "投影内容",
        "sensitivity": "INHERIT_SOURCE_PENDING_REVIEW"
      },
      {
        "name": "projected_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "投影生成时间",
        "sensitivity": "INHERIT_SOURCE_PENDING_REVIEW"
      }
    ]
  },
  {
    "tableName": "rm_audit_version_projection",
    "tableId": "TBL-RDM-004",
    "moduleCode": "TRACE",
    "tableKind": "READ_MODEL",
    "companyScope": true,
    "chineseName": "审计版本投影读模型",
    "primaryKey": [
      "company_id",
      "read_model_key"
    ],
    "columns": [
      {
        "name": "company_id",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "公司上下文",
        "sensitivity": "INHERIT_SOURCE_PENDING_REVIEW"
      },
      {
        "name": "read_model_key",
        "type": "VARCHAR(200)",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "读模型业务/投影键",
        "sensitivity": "INHERIT_SOURCE_PENDING_REVIEW"
      },
      {
        "name": "source_event_version",
        "type": "BIGINT",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "来源事件版本",
        "sensitivity": "INHERIT_SOURCE_PENDING_REVIEW"
      },
      {
        "name": "source_updated_at",
        "type": "TIMESTAMPTZ",
        "nullable": true,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "来源更新时间",
        "sensitivity": "INHERIT_SOURCE_PENDING_REVIEW"
      },
      {
        "name": "projection_payload",
        "type": "JSONB",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": false,
        "description": "投影内容",
        "sensitivity": "INHERIT_SOURCE_PENDING_REVIEW"
      },
      {
        "name": "projected_at",
        "type": "TIMESTAMPTZ",
        "nullable": false,
        "identity": false,
        "actorContext": false,
        "hasDatabaseDefault": true,
        "description": "投影生成时间",
        "sensitivity": "INHERIT_SOURCE_PENDING_REVIEW"
      }
    ]
  }
] as const satisfies readonly TableCatalog[];
export const tableCatalogByName = new Map<string, TableCatalog>(schemaCatalog.map((table) => [table.tableName, table as TableCatalog]));
