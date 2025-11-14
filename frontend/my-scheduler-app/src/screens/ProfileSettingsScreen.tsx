// src/screens/ProfileSettingsScreen.tsx
import React, { useContext, useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordSchema } from '../validation/schemas';
import { z } from 'zod';
import { AuthContext } from '../context/AuthContext';

type Form = z.infer<typeof changePasswordSchema>;

export default function ProfileSettingsScreen() {
    const { changePassword } = useContext(AuthContext);
    const [apiError, setApiError] = useState('');
    const [success, setSuccess] = useState('');
    const { setValue, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(changePasswordSchema) });

    const onSubmit = async (data: Form) => {
        try {
            setApiError(''); setSuccess('');
            await changePassword(data);
            setSuccess('Password changed. You will be logged out.');
        } catch (e: any) {
            setApiError(e?.response?.data?.error || 'Change failed');
        }
    };

    return (
        <View style={{ padding: 16, gap: 12 }}>
            <Text>Current Password</Text>
            <TextInput secureTextEntry onChangeText={(v) => setValue('current_password', v)} style={{ borderWidth: 1, padding: 8 }} />
            {errors.current_password && <Text>{errors.current_password.message}</Text>}

            <Text>New Password</Text>
            <TextInput secureTextEntry onChangeText={(v) => setValue('new_password', v)} style={{ borderWidth: 1, padding: 8 }} />
            {errors.new_password && <Text>{errors.new_password.message}</Text>}

            <Text>Confirm Password</Text>
            <TextInput secureTextEntry onChangeText={(v) => setValue('confirm_password', v)} style={{ borderWidth: 1, padding: 8 }} />
            {errors.confirm_password && <Text>{errors.confirm_password.message}</Text>}

            {success ? <Text>{success}</Text> : null}
            {apiError ? <Text>{apiError}</Text> : null}
            <Button title={isSubmitting ? 'Saving...' : 'Change Password'} onPress={handleSubmit(onSubmit)} />
        </View>
    );
}
