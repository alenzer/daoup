#[cfg(test)]
mod tests {
    use crate::msg::InstantiateMsg;
    use cosmwasm_std::{Addr, Coin, Empty, Uint128};
    use cw_multi_test::{App, AppBuilder, Contract, ContractWrapper, Executor};

    pub fn feature_contract() -> Box<dyn Contract<Empty>> {
        let contract = ContractWrapper::new(
            crate::contract::execute,
            crate::contract::instantiate,
            crate::contract::query,
        );
        Box::new(contract)
    }

    const USER1: &str = "USER1";
    const USER2: &str = "USER2";
    const ADMIN: &str = "ADMIN";
    const DENOM: &str = "denom";

    fn mock_app() -> App {
        AppBuilder::new().build(|router, _, storage| {
            router
                .bank
                .init_balance(
                    storage,
                    &Addr::unchecked(USER1),
                    vec![Coin {
                        denom: DENOM.to_string(),
                        amount: Uint128::new(1),
                    }],
                )
                .unwrap();
        })
    }

    fn proper_instantiate() -> (App, Addr) {
        let mut app = mock_app();
        let feature_id = app.store_code(feature_contract());

        let msg = InstantiateMsg {};
        let feature_contract_addr = app
            .instantiate_contract(feature_id, Addr::unchecked(ADMIN), &msg, &[], "test", None)
            .unwrap();

        (app, feature_contract_addr)
    }

    mod update {
        use super::*;
        use crate::{
            msg::{ExecuteMsg, ListMemberResponse, QueryMsg},
            ContractError,
        };

        #[test]
        fn add_remove() {
            let (mut app, feature_contract_addr) = proper_instantiate();

            // Success Add
            let user1 = Addr::unchecked(USER1);
            let res = app.execute_contract(
                Addr::unchecked(ADMIN),
                feature_contract_addr.clone(),
                &ExecuteMsg::Add { dao: user1.clone() },
                &[],
            );
            assert!(res.is_ok());

            // Check nums of members
            let response: ListMemberResponse = app
                .wrap()
                .query_wasm_smart(feature_contract_addr.clone(), &QueryMsg::ListMembers {})
                .unwrap();
            let members = response.members;
            assert_eq!(members.len(), 1);

            // Fail with already added DAO
            let err: ContractError = app
                .execute_contract(
                    Addr::unchecked(ADMIN),
                    feature_contract_addr.clone(),
                    &ExecuteMsg::Add { dao: user1.clone() },
                    &[],
                )
                .unwrap_err()
                .downcast()
                .unwrap();

            assert_eq!(ContractError::AlreadyAdded {}, err);

            // Fail with removing none exist DAO
            let user2 = Addr::unchecked(USER2);
            let err: ContractError = app
            .execute_contract(
                Addr::unchecked(ADMIN),
                feature_contract_addr.clone(),
                &ExecuteMsg::Remove { dao: user2.clone() },
                &[],
            )
            .unwrap_err()
            .downcast()
            .unwrap();

            assert_eq!(ContractError::NotExist {  }, err);

            // Fail with removing by unauthorized 
            let err: ContractError = app
            .execute_contract(
                Addr::unchecked(user2),
                feature_contract_addr.clone(),
                &ExecuteMsg::Remove { dao: user1.clone() },
                &[],
            )
            .unwrap_err()
            .downcast()
            .unwrap();

            assert_eq!(ContractError::Unauthorized {  }, err);

            // Sucess with Remove
            let res = app.execute_contract(
                Addr::unchecked(ADMIN),
                feature_contract_addr.clone(),
                &ExecuteMsg::Remove { dao: user1.clone() },
                &[],
            );
            assert!(res.is_ok());

        }
    }
}
