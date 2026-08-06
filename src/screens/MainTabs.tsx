import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { colors, typography } from "../theme/tokens";
import HomeScreen from "./HomeScreen";
import ExpensesScreen from "./ExpensesScreen";
import IncomeScreen from "./IncomeScreen";
import CategoriesScreen from "./CategoriesScreen";
import AccountScreen from "./AccountScreen";

const Tab = createBottomTabNavigator();

// 5-tab text-only shell (01-UI-SPEC Implementation Contract line 255):
// exactly 5 label-only tabs in order, no icons, no headers, no custom
// transitions — "text is the interface". Standard v7 defaults for lazy
// loading and state preservation.
export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontSize: typography.label.size },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Expenses" component={ExpensesScreen} />
      <Tab.Screen name="Income" component={IncomeScreen} />
      <Tab.Screen name="Categories" component={CategoriesScreen} />
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  );
}
