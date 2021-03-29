# Ditching Docker-Compose for Kubernetes?

Usually I incorporate Docker Compose into my local development workflow: Bringing up supporting containers needed to run databases, reverse proxies, other applications, or just to see how the container I'm developing works. Given that [Docker Desktop](https://www.docker.com/products/docker-desktop) comes with a [single node] Kubernetes (K8s) cluster and I usually end up deploying my containers to a Kubernetes cluster, I thought it would be good to figure out if I can switch from Docker-Compose to Kubernetes for local development. On top of that it's a good place to work the kinks out of my Kubernetes manifests or Helm charts without disrupting any shared environments.

To validate this I need to know how I'm going to handle the following:
* Building an image locally and running it on the K8s cluster.
* Making changes to an image and updating K8s with those changes.
* Running images on K8s that require persistent data (volume mounts).
* Running images on K8s that can communicate with process running on the host OS.
* Have a app on the host OS that can communicate with images running on K8s.

I'm going to setup the following applications to validate all of this:
1. An API Server that keeps count of the number of requests. The count will be saved into a file so this is where we can get a handle on the persistence. This will also let us try out communication from a process on the host OS to an app running on local K8s. Finally this is where we can experiment with making updates to an image and redeploying. Let's call it the Request Count Server.
1. A Webapp that makes a call to the Request Count Server and displays the results. This will be the app will be a host-os process, so we can try out making a call from an app on the host OS to an app on K8s (the Request Count Server). We're going to with a Single Page Application (SPA) that is also Server Side Rendered (SSR) so we have a reason to throw in a ...
1. Reverse Proxy. This will run on kubernetes and direct some http requests to the Webapp and some http requests to the Request Count Server. This should showcase an app running in k8s able to communicate with an app running on the host OS as well as typically inter-cluster communication we expect from k8s.

So we should see the flow of information like this:

<!-- TODO: Fix diagram. Maybe use an image -->
Browser --> Reverse Proxy (K8s) --> Webapp (Host OS)
                         \--> Request Count Server (K8s)

An understanding of Docker and Kubernetes is required for this article. If you are following along from the [code base](https://github.com/PaulDMooney/Local-K8s-Dev-Blog/) make sure that Kubernetes is enabled in your Docker Desktop instance.


## The Request Count Server
This will be where a big chunk of the experiment is because it's where we're going to cover building an image and running it in k8s and, making changes, and persistence.

For a recap of what this is: It's a Node/express server that keeps count of and responds back the number of requests and saves it to a file, like a cheap database. It listens on port 3000.
The code can be found [here](https://github.com/PaulDMooney/Local-K8s-Dev-Blog/tree/main/request-count-server).

<!-- TODO: Keep this?? -->
We're going to pretend like this is something that we actively make changes to but would be too hard to run outside of a container (which is not true, but let's pretend).

### Initial Setup

The repo already contains the application, and the Dockerfile. The first thing we need to do is build the docker image:

`npm ci && docker build --tag request-count-server:local .`

This will build and store the image into Docker's local image cache, which is the same image cache K8s will use because it's the same docker instance. This means we don't need to worry about anything fancy like setting up a local [Docker Registry](https://docs.docker.com/registry).

Now let's deploy the application. My deployment.yaml looks like this:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: request-count-server
  labels:
    app.kubernetes.io/name: request-count-server
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: request-count-server
  template:
    metadata:
      labels:
        app.kubernetes.io/name: request-count-server
    spec:
      containers:
        - name: request-count-server
          image: "request-count-server:local"
          imagePullPolicy: Never
          ports:
            - name: http
              containerPort: 3000
              protocol: TCP
```
There are two important things here:
1. The value of the `image` field exactly matches the `--tag` value from our `docker build` command. For local development I advise using a tag that would only exist locally. 
1. The `imagePullPolicy` is set to `Never`. We want to avoid the value `Always` for local development because it will make docker think it needs to pull the image down from a remote registry like [Docker Hub](https://hub.docker.com/). Since the image does not exist on a remote registry it will get stuck on an image pull error. A value of `IfNotPresent` should work as well.

We will also need a `NodePort` type service.yaml to expose this application both inside and outside the cluster:
```yaml
apiVersion: v1
kind: Service
metadata:
  name: request-count-server
  labels:
    app.kubernetes.io/name: request-count-server
spec:
  type: NodePort
  ports:
    - port: 3000
      targetPort: http
      protocol: TCP
      name: http
      nodePort: 30001 
  selector:
    app.kubernetes.io/name: request-count-server
```
Note that you don't have to use a `NodePort` service, you could use [kubectl port-forwarding](https://kubernetes.io/docs/tasks/access-application-cluster/port-forward-access-application-cluster/#forward-a-local-port-to-a-port-on-the-pod) instead but you'll be running that command alot.

Now we can create our deployment and service:
`kubectl create -f deployment.yaml && kubectl create -f service.yaml`

<!-- TODO: Show output of running pods and services -->

And we should be able to access our application on the nodeport at localhost:
`curl http://localhost:30001/request-count`

response: `1`

### Redeploying with Changes

So now that we have an built locally and running on our local K8s cluster. We can see what the experience of making changes and redeploying is going to be like.

Currently the application has hardly any output. I want to update that so it logs the request count to the console every time it increments. I'm just going to add a `console.log("Count", newCount)` after the response is sent, and I want to get those changes up into the app running on the cluster.

<!-- TODO: Show new application code? -->

Once I make the change to the application, I build the image the same way I did the first time: `npm ci && docker build --tag request-count-server:local .`

This unfortunately doesn't get the new version of the application up and running yet. If we run `kubectl get pods` we can see our `request-count-server-*` pod has been running for a while and if we run `kubectl logs request-count-server-*` we don't see our new output when invoking the service.

To get the new version of the application running in kubernetes we just need to get the pod restarted. Two ways to do this:
1. Scale the deployment down to 0 and back up again: `kubectl scale deployment/request-count-server --replicas=0` and then `kubectl scale deployment/request-count-server --replicas=1` (or how ever many replicas you want). This approach is good if you're running multiple replicas.
1. If you only have one replica then it's probably easiest to just delete the pod: `kubectl delete pod request-count-server-*`. The deployment will automatically start a new one. 

Once the new version of the application is running, we can follow the logs of the new pod: `kubectl logs -f request-count-server-*` and every time we invoke the service (`curl http://localhost:30001/request-count`) we should see a log output.
<!-- TODO: show log output -->

But the count has reset since we restarted the pod. It's starting from 1 again. We need it to persist.

### Persistence

## The Webapp

## The Reverse Proxy

## Helm

## Scripting

## Final Thoughts