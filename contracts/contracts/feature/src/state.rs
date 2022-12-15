use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use cosmwasm_std::{Addr};
use cw_storage_plus::Item;

use crate::msg::AddressPriority;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct State {
    pub owner: Addr,
    pub list: Vec<AddressPriority>
}

pub const STATE: Item<State> = Item::new("state");
