# Configuracion de roles Firebase

La aplicacion usa Firebase Authentication con correo y contrasena. El registro publico siempre crea usuarios con rol `client`.

## Crear administrador y trabajadora

1. En Firebase Console abre **Authentication > Sign-in method** y habilita **Email/Password**.
2. En **Authentication > Users**, crea las cuentas de la administradora y de cada trabajadora.
3. Copia el UID de cada cuenta.
4. En **Firestore > users**, crea un documento cuyo ID sea el UID.
5. Usa estos campos:

```text
name: "Nombre de la persona"
email: "correo@ejemplo.com"
phone: "555..."
role: "admin"   // para la administradora
```

Para una trabajadora usa `role: "worker"`.

Los clientes se crean desde **Crear cuenta** y quedan con `role: "client"` automaticamente. El visitante usa una sesion anonima y no necesita documento de usuario.

## Publicar reglas

Despues de modificar `firestore.rules`, publicalas desde Firebase CLI o Firebase Console. Las reglas impiden que clientes o trabajadoras acepten, rechacen o completen citas, aunque intenten llamar directamente a Firestore.
