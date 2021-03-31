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



## Helm

## Scripting

## Comparing to Docker Compose

### Building
### Persistence / Volumes
### Scripting

## Final Thoughts