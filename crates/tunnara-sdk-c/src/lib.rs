use std::ffi::{c_char, CStr, CString};

#[no_mangle]
pub extern "C" fn tunnara_version() -> *mut c_char {
    CString::new(env!("CARGO_PKG_VERSION"))
        .expect("a versão do pacote não pode conter byte NUL")
        .into_raw()
}

/// Libera uma string retornada pelo SDK Tunnara.
///
/// # Safety
///
/// `value` deve ser nulo ou um ponteiro devolvido por uma função deste SDK que
/// transfira a propriedade de uma `CString` ao chamador.
#[no_mangle]
pub unsafe extern "C" fn tunnara_string_free(value: *mut c_char) {
    if !value.is_null() {
        drop(unsafe { CString::from_raw(value) });
    }
}

/// Valida superficialmente um token antes de enviá-lo ao agente.
///
/// # Safety
///
/// `token` deve apontar para uma string C válida e terminada em NUL durante toda
/// a execução da função.
#[no_mangle]
pub unsafe extern "C" fn tunnara_validate_token(token: *const c_char) -> bool {
    if token.is_null() {
        return false;
    }

    unsafe { CStr::from_ptr(token) }.to_bytes().len() >= 16
}
