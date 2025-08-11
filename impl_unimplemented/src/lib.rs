use proc_macro::TokenStream;
use quote::quote;
use syn::{parse_macro_input, ItemTrait};

#[proc_macro_attribute]
pub fn impl_unimplemented(_: TokenStream, item: TokenStream) -> TokenStream {
    let input_trait = parse_macro_input!(item as ItemTrait);
    let trait_ident = &input_trait.ident;

    let methods = input_trait.items.iter().filter_map(|item| {
        if let syn::TraitItem::Fn(m) = item {
            let sig = &m.sig;
            let attrs = &m.attrs;
            Some(quote! {
                #(#attrs)*
                #sig {
                    unimplemented!()
                }
            })
        } else {
            None
        }
    });

    let expanded = quote! {
        #input_trait

        #[allow(unused_variables)]
        #[async_trait::async_trait]
        impl #trait_ident for DummyRepository {
            #(#methods)*
        }
    };

    TokenStream::from(expanded)
}