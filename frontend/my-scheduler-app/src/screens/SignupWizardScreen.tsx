// src/screens/SignupWizardScreen.tsx
import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    Pressable,
    StyleSheet,
    ScrollView,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { AuthAPI } from '../api/api';

type OwnerForm = {
    username: string;
    email: string;
    password: string;
    confirm_password: string;
};

type CompanyForm = {
    name: string;
    email: string;
    address: string;
    city: string;
    country: string;
    postalCode: string;   // maps to company.postal_code
};

type LocationForm = {
    id: string;
    name: string;
    address: string;
    postalCode: string;   // maps to location.postal_code
};

type PaymentForm = {
    plan: 'basic' | 'pro';
    coupon: string;
};

const createEmptyLocation = (): LocationForm => ({
    id: Math.random().toString(36).slice(2),
    name: '',
    address: '',
    postalCode: '',
});

export default function SignupWizardScreen({ navigation }: any) {
    const [step, setStep] = useState<0 | 1 | 2>(0);

    // NEW: Owner form (required by RegistrationService)
    const [owner, setOwner] = useState<OwnerForm>({
        username: '',
        email: '',
        password: '',
        confirm_password: '',
    });

    const [company, setCompany] = useState<CompanyForm>({
        name: '',
        email: '',
        address: '',
        city: '',
        country: '',
        postalCode: '',
    });

    const [locations, setLocations] = useState<LocationForm[]>([
        createEmptyLocation(),
    ]);

    const [payment, setPayment] = useState<PaymentForm>({
        plan: 'basic',
        coupon: '',
    });

    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // --- validation helpers ---
    const validateStep0 = () => {
        const e: Record<string, string> = {};

        // Owner fields required
        if (!owner.username.trim()) e['owner.username'] = 'Owner name is required.';
        if (!owner.email.trim()) e['owner.email'] = 'Owner email is required.';
        if (owner.email && !owner.email.includes('@'))
            e['owner.email'] = 'Please enter a valid email.';
        if (!owner.password.trim()) e['owner.password'] = 'Password is required.';
        if (!owner.confirm_password.trim())
            e['owner.confirm_password'] = 'Please confirm your password.';
        if (
            owner.password.trim() &&
            owner.confirm_password.trim() &&
            owner.password.trim() !== owner.confirm_password.trim()
        ) {
            e['owner.confirm_password'] = 'Passwords do not match.';
        }

        // Company fields required by RegistrationService
        if (!company.name.trim()) e['company.name'] = 'Company name is required.';
        if (!company.email.trim()) e['company.email'] = 'Company email is required.';
        if (company.email && !company.email.includes('@'))
            e['company.email'] = 'Please enter a valid email.';
        if (!company.address.trim())
            e['company.address'] = 'Company address is required.';
        if (!company.city.trim())
            e['company.city'] = 'City is required.';
        if (!company.country.trim())
            e['company.country'] = 'Country is required.';
        if (!company.postalCode.trim())
            e['company.postalCode'] = 'Postal code is required.';

        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const validateStep1 = () => {
        const e: Record<string, string> = {};
        if (locations.length === 0) {
            e['locations._'] = 'Add at least one location.';
        } else {
            locations.forEach((loc, idx) => {
                if (!loc.name.trim()) e[`locations.${idx}.name`] = 'Required';
                if (!loc.address.trim()) e[`locations.${idx}.address`] = 'Required';
                // Backend requires postal_code on location as well
                if (!loc.postalCode.trim())
                    e[`locations.${idx}.postalCode`] = 'Required';
            });
        }
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleNext = () => {
        if (step === 0 && !validateStep0()) return;
        if (step === 1 && !validateStep1()) return;
        setErrors({});
        setStep((prev) => (prev === 2 ? prev : ((prev + 1) as 0 | 1 | 2)));
    };

    const handleBack = () => {
        // if on first step, go back to Login screen
        if (step === 0) {
            navigation.navigate('Login');
            return;
        }
        setErrors({});
        setStep((prev) => ((prev - 1) as 0 | 1 | 2));
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            // Use FIRST location from the list for the initial wizard,
            // because RegistrationService expects a single "location" dict.
            const firstLoc = locations[0];

            const payload = {
                owner: {
                    username: owner.username.trim(),
                    email: owner.email.trim(),
                    password: owner.password,
                    confirm_password: owner.confirm_password,
                },
                company: {
                    name: company.name.trim(),
                    email: company.email.trim(),
                    address: company.address.trim(),
                    city: company.city.trim(),
                    country: company.country.trim(),
                    postal_code: company.postalCode.trim(),
                },
                location: {
                    name: firstLoc?.name.trim() || '',
                    address: firstLoc?.address.trim() || '',
                    postal_code: firstLoc?.postalCode.trim() || '',
                },
                // extra fields (backend can ignore or use later)
                plan: payment.plan,
                coupon: payment.coupon.trim() || null,
            };

            console.log('Owner signup payload for /auth/register', payload);

            await AuthAPI.registerOwner(payload);

            Alert.alert(
                'Account created',
                'Your owner account, company and first location were registered.',
                [
                    {
                        text: 'OK',
                        onPress: () =>
                            navigation.reset({ index: 0, routes: [{ name: 'Login' }] }),
                    },
                ]
            );
        } catch (err: any) {
            console.error('Register owner error', err);
            const msg =
                err?.response?.data?.error ||
                err?.response?.data?.message ||
                'We could not finish sign up. Please try again.';
            Alert.alert('Something went wrong', msg);
        } finally {
            setSubmitting(false);
        }
    };

    // --- location handlers ---
    const updateLocation = (id: string, patch: Partial<LocationForm>) => {
        setLocations((prev) =>
            prev.map((loc) => (loc.id === id ? { ...loc, ...patch } : loc))
        );
    };

    const addLocation = () => {
        setLocations((prev) => [...prev, createEmptyLocation()]);
    };

    const removeLocation = (id: string) => {
        setLocations((prev) => prev.filter((loc) => loc.id !== id));
    };

    // --- render ---
    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.header}>
                <Pressable onPress={handleBack} style={{ padding: 4 }}>
                    <Ionicons
                        name="chevron-back"
                        size={24}
                        color={colors.text}
                    />
                </Pressable>
                <Text style={styles.headerTitle}>Owner sign up</Text>
                <View style={{ width: 24 }} />
            </View>

            {/* step indicator */}
            <View style={styles.stepRow}>
                <WizardDot label="Owner & Company" active={step === 0} done={step > 0} index={1} />
                <WizardDot label="Location(s)" active={step === 1} done={step > 1} index={2} />
                <WizardDot label="Payment" active={step === 2} done={false} index={3} />
            </View>

            <ScrollView
                style={styles.body}
                contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
                keyboardShouldPersistTaps="handled"
            >
                {step === 0 && (
                    <OwnerCompanyStep
                        owner={owner}
                        company={company}
                        errors={errors}
                        onChangeOwner={(patch) => setOwner((o) => ({ ...o, ...patch }))}
                        onChangeCompany={(patch) =>
                            setCompany((c) => ({ ...c, ...patch }))
                        }
                    />
                )}

                {step === 1 && (
                    <LocationsStep
                        locations={locations}
                        errors={errors}
                        onChangeLocation={updateLocation}
                        onAddLocation={addLocation}
                        onRemoveLocation={removeLocation}
                    />
                )}

                {step === 2 && (
                    <PaymentStep
                        value={payment}
                        onChange={(patch) => setPayment((p) => ({ ...p, ...patch }))}
                    />
                )}
            </ScrollView>

            {/* footer buttons */}
            <View style={styles.footer}>
                {/* Back on the left */}
                <Pressable
                    style={[styles.footerBtn, styles.footerBtnGhost]}
                    onPress={handleBack}
                    disabled={submitting}
                >
                    <Text style={[styles.footerBtnText, { color: colors.text }]}>
                        Back
                    </Text>
                </Pressable>

                {/* Next / Create account on the right */}
                {step < 2 ? (
                    <Pressable
                        style={[styles.footerBtn, styles.footerBtnPrimary]}
                        onPress={handleNext}
                        disabled={submitting}
                    >
                        <Text
                            style={[styles.footerBtnText, { color: colors.buttonText }]}
                        >
                            Next
                        </Text>
                    </Pressable>
                ) : (
                    <Pressable
                        style={[styles.footerBtn, styles.footerBtnPrimary]}
                        onPress={handleSubmit}
                        disabled={submitting}
                    >
                        <Text
                            style={[styles.footerBtnText, { color: colors.buttonText }]}
                        >
                            {submitting ? 'Creating…' : 'Create account'}
                        </Text>
                    </Pressable>
                )}
            </View>
        </SafeAreaView>
    );
}

/* ──────────────────────
   Sub components
   ────────────────────── */

function WizardDot({
    label,
    active,
    done,
    index,
}: {
    label: string;
    active: boolean;
    done: boolean;
    index: number;
}) {
    const bg = done || active ? colors.primary : '#E5E7EB';
    const textColor = done || active ? '#FFFFFF' : '#6B7280';

    return (
        <View style={styles.stepItem}>
            <View style={[styles.stepCircle, { backgroundColor: bg }]}>
                <Text style={[styles.stepCircleText, { color: textColor }]}>{index}</Text>
            </View>
            <Text
                style={[
                    styles.stepLabel,
                    { color: active || done ? colors.text : colors.gray },
                ]}
            >
                {label}
            </Text>
        </View>
    );
}

function OwnerCompanyStep({
    owner,
    company,
    errors,
    onChangeOwner,
    onChangeCompany,
}: {
    owner: OwnerForm;
    company: CompanyForm;
    errors: Record<string, string>;
    onChangeOwner: (patch: Partial<OwnerForm>) => void;
    onChangeCompany: (patch: Partial<CompanyForm>) => void;
}) {
    return (
        <>
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Owner account</Text>

                <LabeledInput
                    label="Owner name"
                    placeholder="John Doe"
                    value={owner.username}
                    onChangeText={(t: string) => onChangeOwner({ username: t })}
                    error={errors['owner.username']}
                />

                <LabeledInput
                    label="Owner email"
                    placeholder="owner@yourcafe.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={owner.email}
                    onChangeText={(t: string) => onChangeOwner({ email: t })}
                    error={errors['owner.email']}
                />

                <LabeledInput
                    label="Password"
                    placeholder="••••••••"
                    secureTextEntry
                    value={owner.password}
                    onChangeText={(t: string) => onChangeOwner({ password: t })}
                    error={errors['owner.password']}
                />

                <LabeledInput
                    label="Confirm password"
                    placeholder="••••••••"
                    secureTextEntry
                    value={owner.confirm_password}
                    onChangeText={(t: string) =>
                        onChangeOwner({ confirm_password: t })
                    }
                    error={errors['owner.confirm_password']}
                />
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>Company details</Text>

                <LabeledInput
                    label="Company name"
                    placeholder="Downtown Coffee Inc."
                    value={company.name}
                    onChangeText={(t: string) => onChangeCompany({ name: t })}
                    error={errors['company.name']}
                />

                <LabeledInput
                    label="Company email"
                    placeholder="info@yourcafe.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={company.email}
                    onChangeText={(t: string) => onChangeCompany({ email: t })}
                    error={errors['company.email']}
                />

                <LabeledInput
                    label="Street address"
                    placeholder="123 Main Street"
                    value={company.address}
                    onChangeText={(t: string) => onChangeCompany({ address: t })}
                    error={errors['company.address']}
                />

                <LabeledInput
                    label="City"
                    placeholder="Toronto"
                    value={company.city}
                    onChangeText={(t: string) => onChangeCompany({ city: t })}
                    error={errors['company.city']}
                />

                <LabeledInput
                    label="Country"
                    placeholder="Canada"
                    value={company.country}
                    onChangeText={(t: string) => onChangeCompany({ country: t })}
                    error={errors['company.country']}
                />

                <LabeledInput
                    label="Postal code"
                    placeholder="M5V 1L7"
                    value={company.postalCode}
                    onChangeText={(t: string) => onChangeCompany({ postalCode: t })}
                    error={errors['company.postalCode']}
                />
            </View>
        </>
    );
}

function LocationsStep({
    locations,
    errors,
    onChangeLocation,
    onAddLocation,
    onRemoveLocation,
}: {
    locations: LocationForm[];
    errors: Record<string, string>;
    onChangeLocation: (id: string, patch: Partial<LocationForm>) => void;
    onAddLocation: () => void;
    onRemoveLocation: (id: string) => void;
}) {
    return (
        <View style={styles.card}>
            <Text style={styles.cardTitle}>Location(s)</Text>
            <Text style={styles.cardSub}>
                Add each store, restaurant or branch. Postal code is required for now.
            </Text>

            {locations.map((loc, index) => (
                <View key={loc.id} style={styles.locationBlock}>
                    <View style={styles.locationHeader}>
                        <Text style={styles.locationTitle}>Location #{index + 1}</Text>
                        {locations.length > 1 && (
                            <Pressable onPress={() => onRemoveLocation(loc.id)} hitSlop={8}>
                                <Ionicons name="trash-outline" size={18} color={colors.gray} />
                            </Pressable>
                        )}
                    </View>

                    <LabeledInput
                        label="Location name"
                        placeholder="Downtown Café"
                        value={loc.name}
                        onChangeText={(t: string) =>
                            onChangeLocation(loc.id, { name: t })
                        }
                        error={errors[`locations.${index}.name`]}
                    />

                    <LabeledInput
                        label="Location address"
                        placeholder="456 King Street W, Toronto"
                        value={loc.address}
                        onChangeText={(t: string) =>
                            onChangeLocation(loc.id, { address: t })
                        }
                        error={errors[`locations.${index}.address`]}
                    />

                    <LabeledInput
                        label="Postal code"
                        placeholder="M5V 1L7"
                        value={loc.postalCode}
                        onChangeText={(t: string) =>
                            onChangeLocation(loc.id, { postalCode: t })
                        }
                        error={errors[`locations.${index}.postalCode`]}
                    />
                </View>
            ))}

            <Pressable style={styles.addLocBtn} onPress={onAddLocation}>
                <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                <Text style={styles.addLocText}>Add another location</Text>
            </Pressable>

            {errors['locations._'] && (
                <Text style={styles.errorText}>{errors['locations._']}</Text>
            )}
        </View>
    );
}

function PaymentStep({
    value,
    onChange,
}: {
    value: PaymentForm;
    onChange: (patch: Partial<PaymentForm>) => void;
}) {
    return (
        <View style={styles.card}>
            <Text style={styles.cardTitle}>Payment</Text>
            <Text style={styles.cardSub}>
                Choose a plan. This section is wired for future Stripe/checkout
                integration — right now it’s just collecting intent.
            </Text>

            <View style={styles.planRow}>
                <PlanChip
                    label="Basic (up to 10 staff)"
                    price="$29 / month"
                    active={value.plan === 'basic'}
                    onPress={() => onChange({ plan: 'basic' })}
                />
                <PlanChip
                    label="Pro (multi-location)"
                    price="$59 / month"
                    active={value.plan === 'pro'}
                    onPress={() => onChange({ plan: 'pro' })}
                />
            </View>

            <LabeledInput
                label="Promo / coupon code (optional)"
                placeholder="HAPPYCAFE10"
                value={value.coupon}
                onChangeText={(t: string) => onChange({ coupon: t })}
            />

            <View style={styles.paymentPlaceholder}>
                <Ionicons name="card-outline" size={22} color={colors.gray} />
                <Text style={styles.paymentPlaceholderText}>
                    Card details will be entered on our secure checkout page after this
                    step.
                </Text>
            </View>
        </View>
    );
}

function LabeledInput(props: {
    label: string;
    error?: string;
    multiline?: boolean;
    [key: string]: any;
}) {
    const { label, error, multiline, ...rest } = props;
    return (
        <View style={{ marginBottom: 12 }}>
            <Text style={styles.inputLabel}>{label}</Text>
            <TextInput
                style={[
                    styles.input,
                    multiline && styles.inputMultiline,
                    error && { borderColor: '#f97373' },
                ]}
                placeholderTextColor={colors.gray}
                multiline={multiline}
                {...rest}
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
    );
}

function PlanChip({
    label,
    price,
    active,
    onPress,
}: {
    label: string;
    price: string;
    active: boolean;
    onPress: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.planChip,
                active && styles.planChipActive,
                pressed && { opacity: 0.9 },
            ]}
        >
            <Text
                style={[
                    styles.planChipLabel,
                    active && { color: colors.buttonText },
                ]}
            >
                {label}
            </Text>
            <Text
                style={[
                    styles.planChipPrice,
                    active && { color: colors.buttonText },
                ]}
            >
                {price}
            </Text>
        </Pressable>
    );
}

/* ──────────────────────
   Styles
   ────────────────────── */

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
    },

    stepRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 8,
    },
    stepItem: { alignItems: 'center', gap: 4 },
    stepCircle: {
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepCircleText: { fontSize: 13, fontWeight: '700' },
    stepLabel: { fontSize: 11 },

    body: { flex: 1 },

    card: {
        backgroundColor: colors.background,
        borderRadius: 14,
        padding: 14,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 1,
        borderWidth: 1,
        borderColor: '#00000008',
        marginBottom: 16,
    },
    cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 6 },
    cardSub: { fontSize: 12, color: colors.gray, marginBottom: 10 },

    inputLabel: { fontSize: 13, color: colors.text, marginBottom: 4 },
    input: {
        borderWidth: 1,
        borderColor: colors.inputBorder,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontSize: 14,
        color: colors.text,
    },
    inputMultiline: { minHeight: 70, textAlignVertical: 'top' },

    errorText: { color: '#f97373', fontSize: 11, marginTop: 2 },

    locationBlock: {
        marginTop: 8,
        marginBottom: 8,
        paddingVertical: 8,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    locationHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    locationTitle: { fontWeight: '700', fontSize: 13, color: colors.text },

    addLocBtn: {
        marginTop: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    addLocText: { color: colors.primary, fontWeight: '600', fontSize: 13 },

    planRow: { flexDirection: 'row', gap: 10, marginTop: 6, marginBottom: 12 },
    planChip: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 10,
        borderColor: colors.inputBorder,
        padding: 10,
    },
    planChipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    planChipLabel: { fontSize: 13, fontWeight: '600', color: colors.text },
    planChipPrice: { fontSize: 12, color: colors.gray, marginTop: 2 },

    paymentPlaceholder: {
        flexDirection: 'row',
        gap: 8,
        backgroundColor: '#F9FAFB',
        borderRadius: 10,
        padding: 10,
        marginTop: 4,
    },
    paymentPlaceholderText: { fontSize: 12, color: colors.gray, flex: 1 },

    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 10,
    },
    footerBtn: {
        flex: 0.48,
        borderRadius: 999,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    footerBtnGhost: {
        borderWidth: 1,
        borderColor: colors.inputBorder,
        backgroundColor: colors.background,
    },
    footerBtnPrimary: {
        backgroundColor: colors.primary,
    },
    footerBtnText: {
        fontWeight: '700',
        fontSize: 14,
    },
});
