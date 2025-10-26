'use client';

import { useActionState } from 'react';

import { updateUserSettings } from '@/app/account/actions';
import {
    CURRENCY_LOCK_MESSAGE,
    SETTINGS_INITIAL_STATE,
    type SettingsFormState,
} from '@/app/account/_lib/settings-form';

type Props = {
    currencyCode: string;
    displayName: string | null;
    payCycleStartDay: number;
    isCurrencyLocked: boolean;
};

export const SUPPORTED_CURRENCIES = [
    { code: 'AED', label: 'AED – United Arab Emirates Dirham' },
    { code: 'AFN', label: 'AFN – Afghan Afghani' },
    { code: 'ALL', label: 'ALL – Albanian Lek' },
    { code: 'AMD', label: 'AMD – Armenian Dram' },
    { code: 'ANG', label: 'ANG – Netherlands Antillean Guilder' },
    { code: 'AOA', label: 'AOA – Angolan Kwanza' },
    { code: 'ARS', label: 'ARS – Argentine Peso' },
    { code: 'AUD', label: 'AUD – Australian Dollar' },
    { code: 'AWG', label: 'AWG – Aruban Florin' },
    { code: 'AZN', label: 'AZN – Azerbaijani Manat' },
    { code: 'BAM', label: 'BAM – Bosnia and Herzegovina Convertible Mark' },
    { code: 'BBD', label: 'BBD – Barbadian Dollar' },
    { code: 'BDT', label: 'BDT – Bangladeshi Taka' },
    { code: 'BGN', label: 'BGN – Bulgarian Lev' },
    { code: 'BHD', label: 'BHD – Bahraini Dinar' },
    { code: 'BIF', label: 'BIF – Burundian Franc' },
    { code: 'BMD', label: 'BMD – Bermudian Dollar' },
    { code: 'BND', label: 'BND – Brunei Dollar' },
    { code: 'BOB', label: 'BOB – Bolivian Boliviano' },
    { code: 'BRL', label: 'BRL – Brazilian Real' },
    { code: 'BSD', label: 'BSD – Bahamian Dollar' },
    { code: 'BTN', label: 'BTN – Bhutanese Ngultrum' },
    { code: 'BWP', label: 'BWP – Botswana Pula' },
    { code: 'BYN', label: 'BYN – Belarusian Ruble' },
    { code: 'BZD', label: 'BZD – Belize Dollar' },
    { code: 'CAD', label: 'CAD – Canadian Dollar' },
    { code: 'CDF', label: 'CDF – Congolese Franc' },
    { code: 'CHF', label: 'CHF – Swiss Franc' },
    { code: 'CLP', label: 'CLP – Chilean Peso' },
    { code: 'CNY', label: 'CNY – Chinese Yuan' },
    { code: 'COP', label: 'COP – Colombian Peso' },
    { code: 'CRC', label: 'CRC – Costa Rican Colón' },
    { code: 'CUP', label: 'CUP – Cuban Peso' },
    { code: 'CVE', label: 'CVE – Cape Verdean Escudo' },
    { code: 'CZK', label: 'CZK – Czech Koruna' },
    { code: 'DJF', label: 'DJF – Djiboutian Franc' },
    { code: 'DKK', label: 'DKK – Danish Krone' },
    { code: 'DOP', label: 'DOP – Dominican Peso' },
    { code: 'DZD', label: 'DZD – Algerian Dinar' },
    { code: 'EGP', label: 'EGP – Egyptian Pound' },
    { code: 'ERN', label: 'ERN – Eritrean Nakfa' },
    { code: 'ETB', label: 'ETB – Ethiopian Birr' },
    { code: 'EUR', label: 'EUR – Euro' },
    { code: 'FJD', label: 'FJD – Fijian Dollar' },
    { code: 'FKP', label: 'FKP – Falkland Islands Pound' },
    { code: 'FOK', label: 'FOK – Faroese Króna' },
    { code: 'GBP', label: 'GBP – British Pound' },
    { code: 'GEL', label: 'GEL – Georgian Lari' },
    { code: 'GGP', label: 'GGP – Guernsey Pound' },
    { code: 'GHS', label: 'GHS – Ghanaian Cedi' },
    { code: 'GIP', label: 'GIP – Gibraltar Pound' },
    { code: 'GMD', label: 'GMD – Gambian Dalasi' },
    { code: 'GNF', label: 'GNF – Guinean Franc' },
    { code: 'GTQ', label: 'GTQ – Guatemalan Quetzal' },
    { code: 'GYD', label: 'GYD – Guyanese Dollar' },
    { code: 'HKD', label: 'HKD – Hong Kong Dollar' },
    { code: 'HNL', label: 'HNL – Honduran Lempira' },
    { code: 'HRK', label: 'HRK – Croatian Kuna' },
    { code: 'HTG', label: 'HTG – Haitian Gourde' },
    { code: 'HUF', label: 'HUF – Hungarian Forint' },
    { code: 'IDR', label: 'IDR – Indonesian Rupiah' },
    { code: 'ILS', label: 'ILS – Israeli New Shekel' },
    { code: 'IMP', label: 'IMP – Isle of Man Pound' },
    { code: 'INR', label: 'INR – Indian Rupee' },
    { code: 'IQD', label: 'IQD – Iraqi Dinar' },
    { code: 'IRR', label: 'IRR – Iranian Rial' },
    { code: 'ISK', label: 'ISK – Icelandic Króna' },
    { code: 'JEP', label: 'JEP – Jersey Pound' },
    { code: 'JMD', label: 'JMD – Jamaican Dollar' },
    { code: 'JOD', label: 'JOD – Jordanian Dinar' },
    { code: 'JPY', label: 'JPY – Japanese Yen' },
    { code: 'KES', label: 'KES – Kenyan Shilling' },
    { code: 'KGS', label: 'KGS – Kyrgyzstani Som' },
    { code: 'KHR', label: 'KHR – Cambodian Riel' },
    { code: 'KID', label: 'KID – Kiribati Dollar' },
    { code: 'KMF', label: 'KMF – Comorian Franc' },
    { code: 'KRW', label: 'KRW – South Korean Won' },
    { code: 'KWD', label: 'KWD – Kuwaiti Dinar' },
    { code: 'KYD', label: 'KYD – Cayman Islands Dollar' },
    { code: 'KZT', label: 'KZT – Kazakhstani Tenge' },
    { code: 'LAK', label: 'LAK – Lao Kip' },
    { code: 'LBP', label: 'LBP – Lebanese Pound' },
    { code: 'LKR', label: 'LKR – Sri Lankan Rupee' },
    { code: 'LRD', label: 'LRD – Liberian Dollar' },
    { code: 'LSL', label: 'LSL – Lesotho Loti' },
    { code: 'LYD', label: 'LYD – Libyan Dinar' },
    { code: 'MAD', label: 'MAD – Moroccan Dirham' },
    { code: 'MDL', label: 'MDL – Moldovan Leu' },
    { code: 'MGA', label: 'MGA – Malagasy Ariary' },
    { code: 'MKD', label: 'MKD – Macedonian Denar' },
    { code: 'MMK', label: 'MMK – Myanmar Kyat' },
    { code: 'MNT', label: 'MNT – Mongolian Tögrög' },
    { code: 'MOP', label: 'MOP – Macanese Pataca' },
    { code: 'MRU', label: 'MRU – Mauritanian Ouguiya' },
    { code: 'MUR', label: 'MUR – Mauritian Rupee' },
    { code: 'MVR', label: 'MVR – Maldivian Rufiyaa' },
    { code: 'MWK', label: 'MWK – Malawian Kwacha' },
    { code: 'MXN', label: 'MXN – Mexican Peso' },
    { code: 'MYR', label: 'MYR – Malaysian Ringgit' },
    { code: 'MZN', label: 'MZN – Mozambican Metical' },
    { code: 'NAD', label: 'NAD – Namibian Dollar' },
    { code: 'NGN', label: 'NGN – Nigerian Naira' },
    { code: 'NIO', label: 'NIO – Nicaraguan Córdoba' },
    { code: 'NOK', label: 'NOK – Norwegian Krone' },
    { code: 'NPR', label: 'NPR – Nepali Rupee' },
    { code: 'NZD', label: 'NZD – New Zealand Dollar' },
    { code: 'OMR', label: 'OMR – Omani Rial' },
    { code: 'PAB', label: 'PAB – Panamanian Balboa' },
    { code: 'PEN', label: 'PEN – Peruvian Sol' },
    { code: 'PGK', label: 'PGK – Papua New Guinean Kina' },
    { code: 'PHP', label: 'PHP – Philippine Peso' },
    { code: 'PKR', label: 'PKR – Pakistani Rupee' },
    { code: 'PLN', label: 'PLN – Polish Złoty' },
    { code: 'PYG', label: 'PYG – Paraguayan Guaraní' },
    { code: 'QAR', label: 'QAR – Qatari Riyal' },
    { code: 'RON', label: 'RON – Romanian Leu' },
    { code: 'RSD', label: 'RSD – Serbian Dinar' },
    { code: 'RUB', label: 'RUB – Russian Ruble' },
    { code: 'RWF', label: 'RWF – Rwandan Franc' },
    { code: 'SAR', label: 'SAR – Saudi Riyal' },
    { code: 'SBD', label: 'SBD – Solomon Islands Dollar' },
    { code: 'SCR', label: 'SCR – Seychellois Rupee' },
    { code: 'SDG', label: 'SDG – Sudanese Pound' },
    { code: 'SEK', label: 'SEK – Swedish Krona' },
    { code: 'SGD', label: 'SGD – Singapore Dollar' },
    { code: 'SHP', label: 'SHP – Saint Helena Pound' },
    { code: 'SLE', label: 'SLE – Sierra Leonean Leone' },
    { code: 'SOS', label: 'SOS – Somali Shilling' },
    { code: 'SRD', label: 'SRD – Surinamese Dollar' },
    { code: 'SSP', label: 'SSP – South Sudanese Pound' },
    { code: 'STN', label: 'STN – São Tomé and Príncipe Dobra' },
    { code: 'SYP', label: 'SYP – Syrian Pound' },
    { code: 'SZL', label: 'SZL – Eswatini Lilangeni' },
    { code: 'THB', label: 'THB – Thai Baht' },
    { code: 'TJS', label: 'TJS – Tajikistani Somoni' },
    { code: 'TMT', label: 'TMT – Turkmenistan Manat' },
    { code: 'TND', label: 'TND – Tunisian Dinar' },
    { code: 'TOP', label: 'TOP – Tongan Paʻanga' },
    { code: 'TRY', label: 'TRY – Turkish Lira' },
    { code: 'TTD', label: 'TTD – Trinidad and Tobago Dollar' },
    { code: 'TVD', label: 'TVD – Tuvaluan Dollar' },
    { code: 'TWD', label: 'TWD – New Taiwan Dollar' },
    { code: 'TZS', label: 'TZS – Tanzanian Shilling' },
    { code: 'UAH', label: 'UAH – Ukrainian Hryvnia' },
    { code: 'UGX', label: 'UGX – Ugandan Shilling' },
    { code: 'USD', label: 'USD – United States Dollar' },
    { code: 'UYU', label: 'UYU – Uruguayan Peso' },
    { code: 'UZS', label: 'UZS – Uzbekistani Som' },
    { code: 'VES', label: 'VES – Venezuelan Bolívar Soberano' },
    { code: 'VND', label: 'VND – Vietnamese Đồng' },
    { code: 'VUV', label: 'VUV – Vanuatu Vatu' },
    { code: 'WST', label: 'WST – Samoan Tālā' },
    { code: 'XAF', label: 'XAF – Central African CFA Franc' },
    { code: 'XCD', label: 'XCD – Eastern Caribbean Dollar' },
    { code: 'XOF', label: 'XOF – West African CFA Franc' },
    { code: 'XPF', label: 'XPF – CFP Franc' },
    { code: 'YER', label: 'YER – Yemeni Rial' },
    { code: 'ZAR', label: 'ZAR – South African Rand' },
    { code: 'ZMW', label: 'ZMW – Zambian Kwacha' },
    { code: 'ZWL', label: 'ZWL – Zimbabwean Dollar' },
];

export function AccountSettingsForm({ currencyCode, displayName, payCycleStartDay, isCurrencyLocked }: Props) {
    const [state, formAction] = useActionState<SettingsFormState, FormData>(
        updateUserSettings,
        SETTINGS_INITIAL_STATE,
    );

    return (
        <form action={formAction} className="space-y-4">
            <div className="grid gap-2">
                <label
                    htmlFor="display_name"
                    className="text-sm font-semibold text-slate-900"
                >
                    Display name
                </label>
                <input
                    id="display_name"
                    name="display_name"
                    type="text"
                    defaultValue={displayName ?? ''}
                    placeholder="Jane Doe"
                    className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
                />
                {state.errors?.display_name?.length ? (
                    <p className="text-xs text-red-500">{state.errors.display_name[0]}</p>
                ) : null}
            </div>

            <div className="grid gap-2">
                <label
                    htmlFor="pay_cycle_start_day"
                    className="text-sm font-semibold text-slate-900"
                >
                    Pay period starts on
                </label>
                <input
                    id="pay_cycle_start_day"
                    name="pay_cycle_start_day"
                    type="number"
                    min={1}
                    max={31}
                    defaultValue={payCycleStartDay}
                    className="h-11 w-32 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
                />
                {state.errors?.pay_cycle_start_day?.length ? (
                    <p className="text-xs text-red-500">{state.errors.pay_cycle_start_day[0]}</p>
                ) : null}
                <p className="text-xs text-slate-500">
                    We’ll align budgets and dashboards to this day (e.g., 22 = cycle runs from the 22nd to the 21st).
                </p>
            </div>

            <div className="grid gap-2">
                <label
                    htmlFor="currency_code"
                    className="text-sm font-semibold text-slate-900"
                >
                    Preferred currency
                </label>
                <select
                    id="currency_code"
                    name="currency_code"
                    defaultValue={currencyCode}
                    className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                    disabled={isCurrencyLocked}
                    aria-disabled={isCurrencyLocked}
                >
                    {SUPPORTED_CURRENCIES.map((option) => (
                        <option key={option.code} value={option.code}>
                            {option.label}
                        </option>
                    ))}
                </select>
                {isCurrencyLocked ? (
                    <input type="hidden" name="currency_code" value={currencyCode} />
                ) : null}
                {state.errors?.currency_code?.length ? (
                    <p className="text-xs text-red-500">{state.errors.currency_code[0]}</p>
                ) : null}
                <p className="text-xs text-slate-500">
                    {isCurrencyLocked
                        ? CURRENCY_LOCK_MESSAGE
                        : 'Changing this affects only future transactions. Existing entries keep their original currency.'}
                </p>
            </div>

            {state.message ? (
                <p
                    className={`text-sm font-semibold ${state.ok ? 'text-emerald-600' : 'text-red-500'
                        }`}
                >
                    {state.message}
                </p>
            ) : null}

            <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
                Save settings
            </button>
        </form>
    );
}
