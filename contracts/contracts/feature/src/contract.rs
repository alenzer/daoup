use std::vec;

#[cfg(not(feature = "library"))]
use cosmwasm_std::entry_point;
use cosmwasm_std::{to_binary, Addr, Binary, Deps, DepsMut, Env, MessageInfo, Response, StdResult};
use cw2::set_contract_version;

use crate::error::ContractError;
use crate::msg::{ExecuteMsg, InstantiateMsg, ListMemberResponse, QueryMsg};
use crate::state::{State, STATE};

// version info for migration info
const CONTRACT_NAME: &str = "crates.io:fee-manager";
const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    _msg: InstantiateMsg,
) -> Result<Response, ContractError> {
    set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION)?;

    let state = State {
        owner: info.sender,
        list: vec![],
    };
    STATE.save(deps.storage, &state)?;

    Ok(Response::default()
        .add_attribute("method", "instantiate")
        .add_attribute("owner", state.owner.to_string()))
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn execute(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> Result<Response, ContractError> {
    match msg {
        ExecuteMsg::Add { dao } => execute_add(deps, info, dao),
        ExecuteMsg::Remove { dao } => execute_remove(deps, info, dao),
    }
}

pub fn execute_add(deps: DepsMut, info: MessageInfo, dao: Addr) -> Result<Response, ContractError> {
    let mut state = STATE.load(deps.storage)?;
    // Verify sender has permission to update config.
    if info.sender != state.owner {
        return Err(ContractError::Unauthorized {});
    }

    if state.list.iter().find(|&x| x == &dao) == None {
        state.list.push(dao);
    } else {
        return Err(ContractError::AlreadyAdded {});
    }
    // Save config.
    STATE.save(deps.storage, &state)?;

    Ok(Response::default().add_attribute("method", "add"))
}
pub fn execute_remove(
    deps: DepsMut,
    info: MessageInfo,
    dao: Addr,
) -> Result<Response, ContractError> {
    let mut state = STATE.load(deps.storage)?;
    // Verify sender has permission to update config.
    if info.sender != state.owner {
        return Err(ContractError::Unauthorized {});
    }

    if state.list.iter().find(|&x| *x == dao) == None {
        return Err(ContractError::NotExist {});
    }
    state.list.retain(|x| *x != dao);
    // Save config.
    STATE.save(deps.storage, &state)?;

    Ok(Response::default().add_attribute("method", "remove"))
}
#[cfg_attr(not(feature = "library"), entry_point)]
pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::ListMembers {} => to_binary(&query_list(deps)?),
    }
}

fn query_list(deps: Deps) -> StdResult<ListMemberResponse> {
    let state = STATE.load(deps.storage)?;

    Ok(ListMemberResponse {
        members: state.list,
    })
}
