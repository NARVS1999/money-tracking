// Sign Up screen — three fields (Display Name, Email, Password) matching
// SignInScreen's visual design exactly. On submit calls AuthProvider.signUp;
// success triggers the auth gate swap via onAuthStateChanged (no manual
// navigation). Errors display inline below the Password field.
import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "../auth/AuthProvider";
import { signUpErrorMessage } from "../auth/errors";
import { colors, radius, spacing, typography } from "../theme/tokens";

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedInput, setFocusedInput] = useState<
    "displayName" | "email" | "password" | null
  >(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  // Disabled when any field is empty, password under 6 chars, or while submitting.
  const enabled =
    displayName.length > 0 &&
    email.length > 0 &&
    password.length >= 6 &&
    !submitting;

  const handleSubmit = async () => {
    if (!enabled) return;
    setError(null);
    setSubmitting(true);
    try {
      await signUp(displayName, email, password);
      // Success: do nothing — the gate reacts to onAuthStateChanged and
      // swaps to MainTabs (no manual navigation, no toast).
    } catch (err) {
      // Fields KEEP their values; button re-enables.
      setError(signUpErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Money</Text>

        <Text nativeID="display-name-label" style={styles.label}>
          Display Name
        </Text>
        <TextInput
          style={[
            styles.input,
            focusedInput === "displayName" && styles.inputFocused,
          ]}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Your name"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="words"
          textContentType="name"
          autoComplete="name"
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
          editable={!submitting}
          onFocus={() => setFocusedInput("displayName")}
          onBlur={() => setFocusedInput(null)}
          accessibilityLabel="Display Name"
          accessibilityLabelledBy={["display-name-label"]}
        />

        <Text nativeID="email-label" style={styles.label}>
          Email
        </Text>
        <TextInput
          ref={emailRef}
          style={[
            styles.input,
            focusedInput === "email" && styles.inputFocused,
          ]}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={colors.textSecondary}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="username"
          autoComplete="email"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          editable={!submitting}
          onFocus={() => setFocusedInput("email")}
          onBlur={() => setFocusedInput(null)}
          accessibilityLabel="Email"
          accessibilityLabelledBy={["email-label"]}
        />

        <Text nativeID="password-label" style={styles.label}>
          Password
        </Text>
        <TextInput
          ref={passwordRef}
          style={[
            styles.input,
            focusedInput === "password" && styles.inputFocused,
          ]}
          value={password}
          onChangeText={setPassword}
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          textContentType="newPassword"
          autoComplete="new-password"
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
          editable={!submitting}
          onFocus={() => setFocusedInput("password")}
          onBlur={() => setFocusedInput(null)}
          accessibilityLabel="Password"
          accessibilityLabelledBy={["password-label"]}
        />

        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        <Pressable
          style={[styles.button, !enabled && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!enabled}
          accessibilityRole="button"
          accessibilityState={{ disabled: !enabled }}
        >
          <Text style={styles.buttonLabel}>
            {submitting ? "Creating account…" : "Create account"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.lg,
  },
  title: {
    fontSize: typography.display.size,
    lineHeight: typography.display.lineHeight,
    fontWeight: typography.display.weight,
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  label: {
    fontSize: typography.label.size,
    lineHeight: typography.label.lineHeight,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: colors.textPrimary,
  },
  inputFocused: {
    borderColor: colors.accent,
  },
  error: {
    fontSize: typography.label.size,
    lineHeight: typography.label.lineHeight,
    color: colors.danger,
    marginTop: spacing.sm,
  },
  button: {
    marginTop: spacing.md,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonLabel: {
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    fontWeight: typography.body.weight,
    color: colors.surface,
  },
});
