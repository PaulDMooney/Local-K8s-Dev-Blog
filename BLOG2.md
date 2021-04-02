# Ditching Docker-Compose for Kubernetes?

Usually I incorporate Docker Compose into my local development workflow: Bringing up supporting containers needed to run databases, reverse proxies, other applications, or just to see how the container I'm developing works. Given that [Docker Desktop](https://www.docker.com/products/docker-desktop) comes with a [single node] Kubernetes (K8s) cluster and I usually end up deploying my containers to a Kubernetes cluster, I thought it would be good to figure out if I can switch from Docker-Compose to Kubernetes for local development. On top of that it's a good place to work the kinks out of my Kubernetes manifests or Helm charts without disrupting any shared environments.

To validate this I need to know how I'm going to handle the following:
* Building an image locally and running it on the K8s cluster.
* Making changes to an image and running that newly updated image in K8s.
* Running applications on K8s that require persistent data (volume mounts).
* Running applications on K8s that can communicate with applications running on the host OS.
* Have a app on the host OS that can communicate with images running on K8s.

I'm going to setup the following applications to validate all of this:
1. An API Server that keeps count of the number of requests. The count will be saved into a file so this is where we can get a handle on the persistence. This will also let us try out communication from a process on the host OS to an app running on local K8s. Finally this is where we can experiment with making updates to an image and redeploying. Let's call it the Request Count Server.
1. A Webapp that makes a call to the Request Count Server and displays the results. This will be the app will be a host-os process, so we can try out making a call from an app on the host OS to an app on K8s (the Request Count Server). We're going to with a Single Page Application (SPA) that is also Server Side Rendered (SSR) so we have a reason to throw in a ...
1. Reverse Proxy. This will run on kubernetes and direct some http requests to the Webapp and some http requests to the Request Count Server. This should showcase an app running in k8s able to communicate with an app running on the host OS as well as typically inter-cluster communication we expect from k8s.

So we should see the flow of information like this:

<!-- TODO: Fix diagram. Maybe use an image -->
Browser --> Reverse Proxy (K8s) --> Webapp (Host OS)
                         \--> Request Count Server (K8s)

You can find the application, along with the drafts of this blog, [here](https://github.com/PaulDMooney/Local-K8s-Dev-Blog/) along with an explanation of the setup

## Building and running an image locally

With Docker Compose I can build an image and run it (assuming I have my docker-compose files setup) with just one simple command `docker-compose up --build`. What's the analogue of this with Kubernetes? When I build an image, how can Kubernetes pull it? Do I need to a local [Docker Registry](https://docs.docker.com/registry) to push my image to? 

The answer to that last question is luckily "No". When building an image locally using standard docker build command `docker build --tag my-image:local .` the image is stored in docker's image cache. This is the *same* image cache Kubernetes will use because it's using the *same* docker insance. There's two things to note here:
1. The `image` name of a Kubernetes pod must exactly match the name given via the `--tag` parameter of the `docker build` command. In the example given it's `my-image:local`
1. The `imagePullPolicy` must be set to `Never` or `IfNotPresent`. It can't be set to `Always` otherwise Kubernetes will attempt to pull the image from a remote registry like [Docker Hub](https://hub.docker.com/), and that would be an unnecessary hassle.

```yaml
containers:
  - name: my-container
    image: "my-image:local"
    imagePullPolicy: Never
```
<figcaption>Container definitins would contain an `image` name that matches your build command and an `imagePullPolicy` that is not `Always`</figcaption>

I think that covers how we can build and run an image locally.

## Making changes to an image and re-running it in K8s

If I were making changes to the application or its image and wanted to see it running in Docker Compose I would just run the command `docker-compose up --build` (hmm, did we do that command already?). For kubernetes we can rebuild the image `docker build --tag my-image:local` (did we cover this one too?). So that much is the same as the initial build. But you will probably notice your changes aren't actually running in kubernetes. 

The solution is to delete the pod and recreate it. If you are running single unmanaged pod (which I think is unlikely) you would have to delete it and recreate it yourself from the pod definition yaml. If you're running a deployment or a statefulset you can either delete the pods and they will automatically be recreated for you, or you can scale down the replicas to 0 and then backup again:

* Delete a pod: `kubectl delete pod my-pod-xyz --force`
* Scale down `kubectl scale deployment my-deployment --replicas=0` and then backup `kubectl scale deployment my-deployment --replicas=3`

<!-- Mention how docker-compose is a one step process, whereas with Kubernetes this is a multi-step process or save for later section? -->

## Volumes

In Docker Compose volumes can be fairly straight forward in that you can mount any file or subdirectory from within the directory you are executing `docker-compose` from. That makes it easy to find, inspect and cleanup. But Kubernetes is not the same, I'm not running it from a project's folder like Docker Compose, it's already running on the Docker Desktop Virtual Machine somewhere. So if we defined a volume to mount into a container, where would the data for that volume live? It lives in the Docker Desktop Virtual Machine somewhere (unless you're running WSL 2). Luckily Docker Desktop has file sharing setup with the host OS so I can take advantage of this to do any inspection or cleanup of persistent data.

Going into the Docker Desktop dashboard under Settings/Preferences -> Resources -> File Sharing I can see everything that is available to me. Using this I can create a [hostPath](https://kubernetes.io/docs/concepts/storage/volumes/#hostpath) Persistent Volume that my application can [claim](https://kubernetes.io/docs/concepts/storage/persistent-volumes/#persistentvolumeclaims) and use. In my example below I picked a path under `/Users` since that was already shared:

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: my-volume
spec:
  storageClassName: my-volume-class
  accessModes:
  - ReadWriteMany
  capacity:
    storage: 1Gi
  hostPath:
    path: "/Users/Shared/my-volume"
    type: DirectoryOrCreate
```

This volume obviously differs from what you would use in your dev or prod Kubernetes clusters, so I recommend having a folder of "local" persistent volume definition yamls like this that can be reused by team mates (or your future self) to populate their Kubernetes with. Unfortunately you may have no choice but to have different persistent volume yamls for both Mac and Windows if your team uses a mix of those.

One last thing, this is not unique to local Kubernetes development, if you ever delete the claim to this Persistent Volume you have to remember to delete and recreate the Persistent Volume too if you ever want to run your application again in the future.

## Communicating from Kubernetes to the Host OS

Often times I will be working on an application in the Host OS, most of my primary development is done here, you get the advantages of automatic rebuilds and IDE tooling, etc. There will be other applications that I'd like to run in Kubernetes that can talk to this application on the host OS. For example I may have a reverse proxy like nginx running in Kubernetes that needs to serve up my host OS application. This is surprisingly easy and done exactly the same as we would do it with just Docker or Docker Compose: with the `host.docker.internal` DNS name. 

An example of my nginx config running on kubernetes that reverse proxies my app running on the host port 4200:
```
server {
    listen       80;
    server_name  localhost;

    location / {
        proxy_pass http://host.docker.internal:4200;
    }
```

## Accessing the apps on Kubernetes

Whether it be an application I'm developing on the host OS communicating with an application on Kubernetes or if I want to access the application on Kubernetes in a web browser or some kind of client, that application needs to be exposed. There are two ways to do this. The first, and not my recommended approach, is to use [kubectl port-forwarding](https://kubernetes.io/docs/tasks/access-application-cluster/port-forward-access-application-cluster/#forward-a-local-port-to-a-port-on-the-pod). I don't like this approach because you need to be re-run this command whenever you restart your cluster for every service that needs to be exposed. My preferred approach is to use a [NodePort](https://kubernetes.io/docs/concepts/services-networking/service/#nodeport) service.

A NodePort exposes a port on the kubernetes node that you can access your application through and in Docker Desktop that exposes the port on your host OS.

So I can create a service for my application like this:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-app-service
  labels:
    app.kubernetes.io/name: my-app-service
spec:
  type: NodePort
  ports:
    - port: 3000
      targetPort: http
      protocol: TCP
      name: http
      nodePort: 30001 
  selector:
    app.kubernetes.io/name: my-app
```

And I can access my application at `localhost:30001`!

I prefer to define my nodePort for predictability of the port, but you can leave it empty for Kubernetes to decide what it should be and then there's less chance of a collision for an already occupied port.

Chances are your application's service might not be a ClusterIP or LoadBalancer type when deployed to other Kubernetes clusters, or that the nodePort will have a different value in those clusters. You can get around this by templating your service definition in [Helm](https://helm.sh/).

<!-- TODO conclude the 5 criteria to making this work here? -->

## Helm

Without Helm (or similar tools) using a local Kubernetes cluster for development is pointless beyond just experimentation purposes. We want use the local Kubernetes cluster so that our running applications will mirror shared environments like production as closely as possible. Helm lets us accomplish this by allowing us to template out our kubernetes manifests, and abstract out only the necessary environmental differences into [values files](https://helm.sh/docs/chart_template_guide/values_files/).

When you're using Helm you'll be creating values files for at least every environment, I recommend creating values files for local clusters that can be shared with the team. You can even create personal "overrides" values files that you can use to change some minor configurations for your own purposes (just be sure to .gitignore them). Helm let's you chain these files together and gives precendence to the rightmost file. Eg, `helm upgrade my-app ./my-app -f values-local.yaml -f .values-override.yaml`.

Another benefit of Helm is in it's package management. If your application requires another team's application up and running, they can publish their Helm chart to a remote repository like [ChartMuseum](https://github.com/helm/chartmuseum), you can install their application into your Kubernetes by naming that remote chart combined with a local values file. Eg, `helm install other-teams-app https://charts.mycompany.com/other-teams-app-1.2.3.tgz -f values-other-teams-app.yaml`. This is convenient because it means you don't have to checkout their project and dig through for their helm charts to get up and running, all you need to supply is your own values file.

## Scripting

Working with kubernetes, and then layering in extra tools like Helm, there are a lot of commands to get to know. Most of your team will probably need some kind of containerized apps running locally, but it can be a high bar to expect them to know all of the docker and kubectl and helm commands. As well for your own convenience you want to take the things that are done often and condense them into some simpler scripts. Things like:

* Build and Install your app on the kubernetes cluster: 
```
docker build --tag myimage:local \
&& kubectl apply -f my-volume \
&& my-helm install my-app ./my-app -f values-local.yaml
```
 <!-- TODO verify kubectl apply for pv -->
* Build and restart your app: 
```
docker build --tag myimage:local \
&& kubectl scale deployment my-app --replicas=0 \
&& kubectl scale deployment my-app --replicas=3
``` 
<!-- TODO: does this work for stateful sets? --> 
* Update your configuration: 
```
helm upgrade my-app ./my-app -f values-local.yaml
```
* Install another teams app: 
```
helm install other-teams-app https://charts.mycompany.com/other-teams-app-1.2.3.tgz -f values-other-teams-app.yaml
```
* Cleanup
``` 
helm uninstall my-app \
&& kubectl delete -f my-volume.yaml
&& rm -Rf /path/to/my-volume
```

It can be up to you how to script this whether it be in bash, Makefile, npm scripts, Gradle tasks. Whatever suits your team best.

## Comparing to Docker Compose
<!-- convenience of docker-compose for volumes, building, and running -->
<!-- docker-compose isn't as accurate to production -->
<!-- In a way we're duplicating the work between docker-compose.yamls and kubernetes manifests -->
<!-- Running a local kubernetes requires a good familiarity with kubernetes, or some extra scripting to keep things simple -->
<!-- Kubernetes with helm has the advantage of package manager like feature of conveniently installing someone else's app (??? but the tradeoff is any volumes and values you need to supply to get it to run) -->
<!-- Need to find a way to safeguard against accidentally applying to the wrong cluster. Possibly by using a namespace that wouldn't exist in other clusters -->

## Final Thoughts

## TL;DR