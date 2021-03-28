# Create Angular app:
`npx @angular/cli new webapp`

Make SSR:
`npm run ng -- add @nguniversal/express-engine`

# Build and tag docker image:

`docker build -t {image-name} .`

# Run docker image

`docker --rm run -d -p 80:80 --env-file=.env {image-name}`

# Create setup from helm chart

`helm install request-count-server -f values/values-local.yaml request-count-server`

Note: the second occurence of `request-count-server` is the release and it can affect the service name or how other pods communicate with this.

Make changes
`helm upgrade request-count-server -f values/values-local.yaml request-count-server`

Remove??
`helm uninstall request-count-server`


# Creating a deployment
`k create deployment request-count-server --image=request-count-server:local --port=3000`
`k expose deployment request-count-server --name=request-count-server --port=3000 --type=NodePort`


# Gotchas

If uninstalling and your PVC is removed, the PV remains and can't be reclaimed. It has to be deleted and recreated.
Can set `persistentVolumeReclaimPolicy: Recycle` but then the data does not survive.