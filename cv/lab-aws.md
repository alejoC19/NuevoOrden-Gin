# Laboratorio AWS de seguridad (fin de semana, capa gratuita)

Objetivo: tener un caso propio y real de **riesgo → control → comprobación**.
Regla: cada paso termina con una prueba que muestre que el control funciona. Anotá todo en la plantilla del final.

## 0. Preparación (30 min)
1. Cuenta nueva de AWS. Activá **MFA en el usuario root** y no lo uses más.
2. Billing > Budgets: creá un presupuesto de **USD 5** con alerta por mail.
3. Creá un usuario `lab-admin` (IAM) con MFA para trabajar. Instalá AWS CLI v2 y corré `aws configure --profile admin`.
4. Región: `us-east-1` (todo el lab).

## 1. IAM con mínimo privilegio
**Riesgo:** un usuario con permisos de más puede leer, borrar o filtrar datos.

```bash
# Bucket privado
aws s3api create-bucket --bucket lab-TUNOMBRE-datos --region us-east-1 --profile admin
aws s3api put-public-access-block --bucket lab-TUNOMBRE-datos --profile admin \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
echo hola > prueba.txt && aws s3 cp prueba.txt s3://lab-TUNOMBRE-datos/ --profile admin
```

Archivo `policy.json` (solo lectura de ese bucket):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {"Effect": "Allow", "Action": "s3:ListBucket", "Resource": "arn:aws:s3:::lab-TUNOMBRE-datos"},
    {"Effect": "Allow", "Action": "s3:GetObject", "Resource": "arn:aws:s3:::lab-TUNOMBRE-datos/*"}
  ]
}
```
```bash
aws iam create-policy --policy-name lab-s3-solo-lectura --policy-document file://policy.json --profile admin
aws iam create-user --user-name lab-limitado --profile admin
aws iam attach-user-policy --user-name lab-limitado --profile admin \
  --policy-arn arn:aws:iam::TU_ACCOUNT_ID:policy/lab-s3-solo-lectura
aws iam create-access-key --user-name lab-limitado --profile admin   # guardalas, no las subas a Git
aws configure --profile limitado
```
**Comprobación (anotá cada resultado):**
```bash
aws s3 ls s3://lab-TUNOMBRE-datos --profile limitado          # debe funcionar
aws s3 cp prueba.txt s3://lab-TUNOMBRE-datos/x.txt --profile limitado   # debe dar AccessDenied
aws iam list-users --profile limitado                          # debe dar AccessDenied
aws iam simulate-principal-policy --profile admin \
  --policy-source-arn arn:aws:iam::TU_ACCOUNT_ID:user/lab-limitado \
  --action-names s3:GetObject s3:PutObject s3:DeleteObject \
  --resource-arns arn:aws:s3:::lab-TUNOMBRE-datos/prueba.txt
```
Al terminar, borrá las access keys del usuario limitado si no las necesitás.

## 2. Secretos
**Riesgo:** credenciales en código, `.env` o repos.
```bash
aws secretsmanager create-secret --name lab/app/db --profile admin \
  --secret-string '{"user":"app","password":"valor-de-prueba"}'
```
- Dale al usuario limitado permiso de lectura **solo** de ese secreto (policy con `secretsmanager:GetSecretValue` sobre el ARN del secreto) y probá que otro secreto le da AccessDenied.
- Rotación: cambiá el valor con `aws secretsmanager put-secret-value` y mostrá que la versión anterior queda como `AWSPREVIOUS`. (La rotación automática exige una Lambda o una base RDS; documentá cómo se haría.)
- Prevención de filtraciones: activá el escaneo de secretos de GitHub en tus repos y agregá `.env` al `.gitignore`.

## 3. Red y servidor Linux
**Riesgo:** puertos abiertos al mundo y acceso por contraseña.
1. EC2 `t3.micro` (o t2.micro) con Ubuntu, par de claves nuevo.
2. Security group: **solo puerto 22, desde tu IP** (`/32`). Nada más.
3. En el servidor, `/etc/ssh/sshd_config`: `PasswordAuthentication no`, `PermitRootLogin no`; luego `sudo systemctl restart ssh`. Activá `ufw` (`ufw allow 22/tcp`, `ufw enable`) y `unattended-upgrades`.

**Comprobación:**
```bash
nmap -Pn IP_PUBLICA                         # solo debe aparecer el 22
ssh -o PubkeyAuthentication=no ubuntu@IP    # debe rechazar la contraseña
ssh -i clave.pem root@IP                    # debe rechazar root
```
Probá también desde otra red (datos del celular): debe fallar por el security group.

## 4. Registros y alertas
**Riesgo:** no enterarte de un acceso indebido.
1. CloudTrail: creá un trail multi-región que guarde en un bucket de logs (consola: CloudTrail > Create trail).
2. Enviá el trail a CloudWatch Logs y creá un metric filter para `errorCode = AccessDenied`, con una alarma que te mande un mail por SNS.
**Comprobación:** repetí los `AccessDenied` del paso 1 y verificá que llega la alarma. Anotá cuánto tardó.

## 5. Backups y restauración
```bash
aws s3api put-bucket-versioning --bucket lab-TUNOMBRE-datos --profile admin \
  --versioning-configuration Status=Enabled
```
- Borrá `prueba.txt` y recuperala desde la versión anterior (`aws s3api list-object-versions`).
- Snapshot del volumen EBS del servidor, creá un volumen nuevo desde el snapshot y verificá que los datos están.
Anotá la prueba de restauración: es lo que la oferta pide ("backups y pruebas de restauración").

## 6. Limpieza (para no pagar)
Terminá la instancia EC2, borrá volúmenes y snapshots, vaciá y borrá los buckets, borrá el trail, la alarma, el secreto y las access keys. Revisá Billing al día siguiente.

## Plantilla de evidencias
| Riesgo | Control | Prueba | Resultado esperado | Resultado real |
|---|---|---|---|---|
| Usuario con permisos de más | Policy de solo lectura | `s3 cp` con el usuario limitado | AccessDenied | |
| Credenciales en código | Secrets Manager | Leer otro secreto | AccessDenied | |
| Puertos abiertos | SG solo 22 desde mi IP | `nmap` | solo 22 | |
| Acceso por contraseña | `PasswordAuthentication no` | `ssh` sin clave | rechazo | |
| Sin visibilidad | CloudTrail + alarma | provocar AccessDenied | llega mail | |
| Pérdida de datos | Versionado y snapshot | borrar y restaurar | datos recuperados | |

## Cómo contarlo en la postulación
"Armé un laboratorio en AWS: identifiqué [riesgo], implementé [control] y lo comprobé con [prueba]; el resultado fue [X]." Usá la columna "Resultado real" de tu plantilla.
