#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, Address,
    Env, String, Vec,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    Institution,
    TotalCredentials,
    Credential(u64),
    StudentCredentials(Address),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Credential {
    pub id: u64,
    pub admin: Address,
    pub student: Address,
    pub student_name: String,
    pub course: String,
    pub issue_date: String,
    pub issued_at_ledger: u32,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum CredentialError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    CredentialNotFound = 3,
    EmptyField = 4,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContractInitialized {
    pub admin: Address,
    pub institution: String,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CredentialIssued {
    pub credential_id: u64,
    pub student: Address,
    pub course: String,
    pub issue_date: String,
}

#[contract]
pub struct MeritMintContract;

#[contractimpl]
impl MeritMintContract {
    // Initializes the contract one time with the institution admin and display name.
    pub fn init(env: Env, admin: Address, institution: String) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, CredentialError::AlreadyInitialized);
        }

        admin.require_auth();
        Self::require_non_empty(&env, &institution);

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::Institution, &institution);
        env.storage()
            .instance()
            .set(&DataKey::TotalCredentials, &0u64);

        let initialized_event = ContractInitialized {
            admin: admin.clone(),
            institution: institution.clone(),
        };
        env.events().publish(
            (symbol_short!("meritmint"), symbol_short!("init"), admin),
            initialized_event,
        );
    }

    // Mints a new non-transferable credential for a student wallet. Only the admin can call this.
    pub fn mint(
        env: Env,
        student: Address,
        student_name: String,
        course: String,
        issue_date: String,
    ) -> u64 {
        Self::require_initialized(&env);

        let admin = Self::get_admin(env.clone());
        admin.require_auth();

        Self::require_non_empty(&env, &student_name);
        Self::require_non_empty(&env, &course);
        Self::require_non_empty(&env, &issue_date);

        let next_id = Self::total_credentials(env.clone()) + 1;
        let credential = Credential {
            id: next_id,
            admin,
            student: student.clone(),
            student_name,
            course: course.clone(),
            issue_date: issue_date.clone(),
            issued_at_ledger: env.ledger().sequence(),
        };

        env.storage()
            .persistent()
            .set(&DataKey::Credential(next_id), &credential);

        let student_key = DataKey::StudentCredentials(student.clone());
        let mut student_credentials = env
            .storage()
            .persistent()
            .get(&student_key)
            .unwrap_or_else(|| Vec::new(&env));
        student_credentials.push_back(next_id);
        env.storage()
            .persistent()
            .set(&student_key, &student_credentials);

        env.storage()
            .instance()
            .set(&DataKey::TotalCredentials, &next_id);

        let issued_event = CredentialIssued {
            credential_id: next_id,
            student: student.clone(),
            course,
            issue_date,
        };
        env.events().publish(
            (
                symbol_short!("meritmint"),
                symbol_short!("issued"),
                next_id,
                student,
            ),
            issued_event,
        );

        next_id
    }

    // Returns whether the contract has been initialized with an admin.
    pub fn is_initialized(env: Env) -> bool {
        env.storage().instance().has(&DataKey::Admin)
    }

    // Returns the current institution admin address.
    pub fn get_admin(env: Env) -> Address {
        Self::require_initialized(&env);
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, CredentialError::NotInitialized))
    }

    // Returns the human-readable institution name saved during initialization.
    pub fn get_institution(env: Env) -> String {
        Self::require_initialized(&env);
        env.storage()
            .instance()
            .get(&DataKey::Institution)
            .unwrap_or_else(|| panic_with_error!(&env, CredentialError::NotInitialized))
    }

    // Returns the total number of credentials minted by this contract.
    pub fn total_credentials(env: Env) -> u64 {
        Self::require_initialized(&env);
        env.storage()
            .instance()
            .get(&DataKey::TotalCredentials)
            .unwrap_or(0u64)
    }

    // Returns a single credential by its unique on-chain identifier.
    pub fn get_credential(env: Env, credential_id: u64) -> Credential {
        Self::require_initialized(&env);
        Self::read_credential(&env, credential_id)
    }

    // Returns all credential IDs owned by a student wallet.
    pub fn get_student_credentials(env: Env, student: Address) -> Vec<u64> {
        Self::require_initialized(&env);
        env.storage()
            .persistent()
            .get(&DataKey::StudentCredentials(student))
            .unwrap_or_else(|| Vec::new(&env))
    }

    // Returns the full credential payloads owned by a student wallet.
    pub fn get_student_credential_details(env: Env, student: Address) -> Vec<Credential> {
        Self::require_initialized(&env);

        let credential_ids = Self::get_student_credentials(env.clone(), student);
        let mut credentials = Vec::new(&env);
        let mut index = 0;

        while index < credential_ids.len() {
            let credential_id = credential_ids
                .get(index)
                .unwrap_or_else(|| panic_with_error!(&env, CredentialError::CredentialNotFound));
            credentials.push_back(Self::read_credential(&env, credential_id));
            index += 1;
        }

        credentials
    }

    // Returns true when a student already holds a credential for the supplied course title.
    pub fn has_credential(env: Env, student: Address, course: String) -> bool {
        Self::require_initialized(&env);
        Self::require_non_empty(&env, &course);

        let credentials = Self::get_student_credential_details(env.clone(), student);
        let mut index = 0;

        while index < credentials.len() {
            let credential = credentials
                .get(index)
                .unwrap_or_else(|| panic_with_error!(&env, CredentialError::CredentialNotFound));
            if credential.course == course {
                return true;
            }
            index += 1;
        }

        false
    }

    // Centralized guard so every read/write entrypoint fails consistently before init.
    fn require_initialized(env: &Env) {
        if !env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(env, CredentialError::NotInitialized);
        }
    }

    // Prevents empty on-chain metadata fields that would make credentials ambiguous.
    fn require_non_empty(env: &Env, value: &String) {
        if value.len() == 0 {
            panic_with_error!(env, CredentialError::EmptyField);
        }
    }

    // Loads a credential or throws a contract error when the ID is unknown.
    fn read_credential(env: &Env, credential_id: u64) -> Credential {
        env.storage()
            .persistent()
            .get(&DataKey::Credential(credential_id))
            .unwrap_or_else(|| panic_with_error!(env, CredentialError::CredentialNotFound))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, vec};

    #[test]
    fn initializes_contract_and_reads_metadata() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, MeritMintContract);
        let client = MeritMintContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let institution = String::from_str(&env, "MeritMint Academy");

        client.init(&admin, &institution);

        assert!(client.is_initialized());
        assert_eq!(client.get_admin(), admin);
        assert_eq!(client.get_institution(), institution);
        assert_eq!(client.total_credentials(), 0);
    }

    #[test]
    fn mints_and_reads_student_credentials() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, MeritMintContract);
        let client = MeritMintContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let student = Address::generate(&env);

        client.init(&admin, &String::from_str(&env, "MeritMint Academy"));

        let credential_id = client.mint(
            &student,
            &String::from_str(&env, "Ada Lovelace"),
            &String::from_str(&env, "Distributed Systems"),
            &String::from_str(&env, "2026-05-25"),
        );

        let credential = client.get_credential(&credential_id);
        let student_ids = client.get_student_credentials(&student);
        let student_credentials = client.get_student_credential_details(&student);

        assert_eq!(credential_id, 1);
        assert_eq!(credential.student, student.clone());
        assert_eq!(
            credential.student_name,
            String::from_str(&env, "Ada Lovelace")
        );
        assert_eq!(
            credential.course,
            String::from_str(&env, "Distributed Systems")
        );
        assert_eq!(student_ids, vec![&env, 1u64]);
        assert_eq!(student_credentials.len(), 1);
        assert!(client.has_credential(&student, &String::from_str(&env, "Distributed Systems")));
    }
}
