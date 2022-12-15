use std::env::current_dir;
use std::fs::create_dir_all;

use cosmwasm_schema::{export_schema, remove_schemas, schema_for};

use feature::msg::{ListMemberResponse, ExecuteMsg, InstantiateMsg, QueryMsg};
use feature::state::State;

fn main() {
    let mut out_dir = current_dir().unwrap();
    out_dir.push("schema");
    create_dir_all(&out_dir).unwrap();
    remove_schemas(&out_dir).unwrap();

    export_schema(&schema_for!(InstantiateMsg), &out_dir);
    // EXECUTE
    export_schema(&schema_for!(ExecuteMsg), &out_dir);
    // QUERY
    export_schema(&schema_for!(QueryMsg), &out_dir);
    export_schema(&schema_for!(ListMemberResponse), &out_dir);

    export_schema(&schema_for!(State), &out_dir);
}
