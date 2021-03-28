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

Make changes
`helm upgrade request-count-server -f values/values-local.yaml request-count-server`

Remove??
`helm uninstall request-count-server -f values/values-local.yaml request-count-server`


# Creating a deployment
`k create deployment request-count-server --image=request-count-server:local --port=3000`
`k expose deployment request-count-server --name=request-count-server --port=3000 --type=NodePort`