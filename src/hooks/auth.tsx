import React, { createContext, ReactNode, useContext, useState, useEffect } from "react";
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-google-app-auth';
import * as AppleAuthentication from 'expo-apple-authentication';
import AsyncStorage from "@react-native-async-storage/async-storage";

const { CLIENT_ID } = process.env;
const { REDIRECT_URI } = process.env;

interface AuthProviderProps {
  children: ReactNode //Reactnode = tipagem p/ elemento filho
}

interface User {
  id: string;
  name: string;
  email: string;
  photo?: string;
}

interface AuthContextdata {
  user: User;
  signInWithGoogle(): Promise<void>;
  signInWithApple(): Promise<void>;
  signOut(): Promise<void>;
  userStorageLoading: boolean;
}

interface AuthorizationResponse {
  params: {
    access_token: string;
  };
  type: string;
}

const AuthContext = createContext({} as AuthContextdata);

function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User>({} as User);
  const [userStorageLoading, setUserStorageLoading] = useState(true);

  async function signInWithGoogle() {
    try {
      //De onde obter essas informações? Client ID e RedirectUri em credenciais no GCP, Response é sempre Token, em Scope informar o escopo que deseja
      // CLIENT_ID e REDIRECT_URI movidos para .env por motivos de segurança
      const RESPONSE_TYPE = 'token';
      const SCOPE = encodeURI('profile email');
      //https://accounts.google.com/o/oauth2/v2/auth
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=${RESPONSE_TYPE}&scope=${SCOPE}`;

      const { type, params } = await AuthSession.startAsync({ authUrl }) as AuthorizationResponse;
      //pegando os dados do usuario do Google e salvando em nosso state
      if (type === 'success') {
        const response = await fetch(`https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${params.access_token}`);
        const userInfo = await response.json();
        console.log(user);
        setUser({
          id: userInfo.id,
          email: userInfo.email,
          name: userInfo.given_name,
          photo: userInfo.picture
        });
      }
    } catch (error) {
      throw new Error(error as string);
    }
  }

  async function signInWithApple() {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ]
      });
      if (credential) {
        const name = credential.fullName!.givenName!;
        const photo = `https://ui-avatars.com/api/?name=${name}&length=1`
        const userLogged = {
          id: String(credential.user),
          email: credential.email!,
          name: name,
          photo: photo,
        }
        setUser(userLogged);
        await AsyncStorage.setItem('@gofinances:user', JSON.stringify(userLogged));
      }
    } catch (error) {
      throw new Error(error as string);
    }
  }

  async function signOut() {
    setUser({} as User);
    await AsyncStorage.removeItem('@gofinances:user')
  }

  useEffect(() => {
    async function loadUserStorageData() {
      console.log(user)
      const userStoraged = await AsyncStorage.getItem('@gofinances:user');
      if (userStoraged) {
        const userLogged = JSON.parse(userStoraged) as User;
        setUser(userLogged);
        console.log('user logged => ', userLogged);
      }
      setUserStorageLoading(false);
      console.log('user storaged => ', userStoraged);
    }
    loadUserStorageData();
  }, [])

  return (
    <AuthContext.Provider value={{
      user: user,
      signInWithGoogle,
      signInWithApple,
      signOut,
      userStorageLoading
    }}>
      {children}
    </AuthContext.Provider>
  )
}

function useAuth() {
  const context = useContext(AuthContext);

  return context;
}

export { AuthProvider, useAuth }
