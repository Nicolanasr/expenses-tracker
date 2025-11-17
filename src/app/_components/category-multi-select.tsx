'use client';

import { useMemo } from 'react';
import Select, {
    components,
    type GroupBase,
    type MultiValue,
    type OptionProps,
    type StylesConfig,
} from 'react-select';

type Category = {
    id: string;
    name: string;
    type: 'income' | 'expense';
};

type CategoryMultiSelectProps = {
    categories: Category[];
    value: string[];
    onChange: (value: string[]) => void;
    label?: string;
    description?: string;
    placeholder?: string;
    className?: string;
};

type CategorySelectOption = {
    value: string;
    label: string;
};

export function CategoryMultiSelect({
    categories,
    value,
    onChange,
    label,
    description,
    placeholder = 'All categories',
    className,
}: CategoryMultiSelectProps) {
    const groupedOptions = useMemo<GroupBase<CategorySelectOption>[]>(() => {
        const expenseOptions = categories
            .filter((category) => category.type === 'expense')
            .map((category) => ({ value: category.name, label: category.name }));
        const incomeOptions = categories
            .filter((category) => category.type === 'income')
            .map((category) => ({ value: category.name, label: category.name }));

        const groups: GroupBase<CategorySelectOption>[] = [];
        if (expenseOptions.length) {
            groups.push({ label: 'Expenses', options: expenseOptions });
        }
        if (incomeOptions.length) {
            groups.push({ label: 'Income', options: incomeOptions });
        }
        return groups;
    }, [categories]);

    const flattened = useMemo(
        () => groupedOptions.flatMap((group) => group.options),
        [groupedOptions],
    );
    const selectedOptions = useMemo(
        () => flattened.filter((option) => value.includes(option.value)),
        [flattened, value],
    );

    const selectOptions = useMemo(
        () =>
            [
                { value: '__all__', label: 'Select all categories' },
                ...groupedOptions,
            ] as (CategorySelectOption | GroupBase<CategorySelectOption>)[],
        [groupedOptions],
    );

    const handleChange = (next: MultiValue<CategorySelectOption>) => {
        if (next.some((option) => option.value === '__all__')) {
            onChange(flattened.map((option) => option.value));
            return;
        }
        onChange(next.map((option) => option.value));
    };

    const selectComponents = useMemo(
        () => ({
            Option: (props: OptionProps<CategorySelectOption, true>) => {
                const isSelectAll = props.data.value === '__all__';
                return (
                    <components.Option {...props}>
                        <span className={isSelectAll ? 'font-semibold text-slate-900' : ''}>
                            {props.children}
                        </span>
                    </components.Option>
                );
            },
        }),
        [],
    );

    const selectStyles = useMemo<StylesConfig<CategorySelectOption, true>>(
        () => ({
            control: (base, state) => ({
                ...base,
                borderRadius: '0.75rem',
                borderColor: state.isFocused ? '#818cf8' : '#d1d5db',
                minHeight: '2.75rem',
                boxShadow: 'none',
                '&:hover': {
                    borderColor: '#818cf8',
                },
            }),
            multiValue: (base) => ({
                ...base,
                borderRadius: '9999px',
                backgroundColor: '#eef2ff',
            }),
            multiValueLabel: (base) => ({
                ...base,
                color: '#4338ca',
                fontWeight: 600,
            }),
            option: (base, state) => ({
                ...base,
                backgroundColor: state.isSelected
                    ? '#eef2ff'
                    : state.isFocused
                        ? '#f8fafc'
                        : undefined,
                color: state.isSelected ? '#4338ca' : '#0f172a',
                fontWeight: state.data.value === '__all__' ? 600 : 500,
            }),
        }),
        [],
    );

    return (
        <div className={className}>
            {(label || description || categories.length > 0) && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        {label ? (
                            <p className="text-sm font-semibold text-slate-900">{label}</p>
                        ) : null}
                        {description ? (
                            <p className="text-xs text-slate-500">{description}</p>
                        ) : null}
                    </div>
                </div>
            )}
            <Select
                isMulti
                closeMenuOnSelect={false}
                hideSelectedOptions={false}
                className="mt-2 text-sm font-medium text-slate-900"
                classNamePrefix="category-select"
                placeholder={placeholder}
                value={selectedOptions}
                options={selectOptions}
                onChange={handleChange}
                components={selectComponents}
                styles={selectStyles}
            />
        </div>
    );
}
