# Create Angular app:
`npx @angular/cli new webapp`

Make SSR:
`npm run ng -- add @nguniversal/express-engine`

# Build and tag docker image:

`docker build -t {image-name} .`

# Run docker image

`docker --rm run -d -p 80:80 --env-file=.env {image-name}`