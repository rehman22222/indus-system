import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import LoginScreen from '../screens/LoginScreen';
import PatientDashboard from '../screens/PatientDashboard';
import SpecialtySelectionScreen from '../screens/appointment/SpecialtySelection';
import DoctorSelectionScreen from '../screens/appointment/DoctorSelection';
import SlotSelectionScreen from '../screens/appointment/SlotSelection';
import ConfirmationScreen from '../screens/appointment/Confirmation';

const Stack = createStackNavigator();

const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Indus Mobile App' }} />
        <Stack.Screen name="PatientDashboard" component={PatientDashboard} options={{ title: 'Patient Dashboard' }} />
        <Stack.Screen name="SpecialtySelection" component={SpecialtySelectionScreen} options={{ title: 'Book Appointment' }} />
        <Stack.Screen name="DoctorSelection" component={DoctorSelectionScreen} options={{ title: 'Book Appointment' }} />
        <Stack.Screen name="SlotSelection" component={SlotSelectionScreen} options={{ title: 'Book Appointment' }} />
        <Stack.Screen name="Confirmation" component={ConfirmationScreen} options={{ title: 'Book Appointment' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
