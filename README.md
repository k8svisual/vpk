<img style="float: center;" src="https://raw.githubusercontent.com/k8debug/vpk/main/public/images/vpk.png" width="70" height="70">

## VpK - Visual parsed Kubernetes


Vpk can be installed on a local computer or run from a Docker container.  Refer to the appropriate section for installing the software.


Refer to the __VpK described__ and __YouTube videos on how to use VpK__ sections of this document for information about using the application.  

The Help feature of the application also provides access to the video links along with additional descriptions of VpK features.


<br>


## Local installation
	
__Node.js__ and __npm__ are required to install and execute this application.

You cannot install and run this application without first installing node.js and npm.  After the prerequisites are installed proceed to the next step. 

Download the source files and place in a directory.  The source files are available on github and can be downloaded using the following clone command or retrieved 

git clone http://github.com/k8debug/vpk.git/ 

Change to the directory where the files were placed. Run the following command to install the required Node modules:

	npm install

Once the above has successfully completed the application can be started by using 

	npm start
	
<br>



<br>

## Docker container
	
VpK is available as a Docker container.  The container is available from the following DockerHub account: __k8debug__  container: __vpk__

Example docker pull command: 
```
docker pull k8debug/vpk
```

The container hosts a web application at the default port 4200.

The container requires a volume parameter to identify the direcotyr that will contain cluster snapshots along with port parameter to allow accessing the user interface via a browser.  

Optionally a second volume parameter can be defined to point to a common user configuration file, usercongi.json. Use of this optional parameter will ensure any settings or user defined x-references are available to the container instance of VpK.

Once the image is pulled it can be run by using a command similar to the following.  For the required volume replace "SNAPDIR" with the directory for the local stored snapshots. For the optional volume replace "USERCONF" with the directory that contains the __userconfig.json__ file.

Required volume:
```
-v SNAPDIR:/vpk/cluster
```

Optional volume:
```
-v USERCONFIG:/Vpk/userconfig
```

Example with both volumes defined and mapping local port 4200 to the default port:

```
docker run -v /data/snapshot:/vpk/cluster -v /data/parms:/vpk/cluster -p 4200:4200 k8debug/vpk
```



The cluster snapshot files to be used with the container are created using another progarm available from this same github account.  The repository is for this application is:

git clone http://github.com/k8debug/snapshot.git/ 

Follow the instructions in the snapshot repository for how to build and install the snapshot application.

<br>

## VpK described

VpK was created as the result of wanting a tool to aid in understanding what is defined in Kubernetes.   

VpK is comprised of a server and browser components.  The server component is a node.js application that communictes with running instances of K8 using the kubectl CLI application.  When using K8 versions that require a custom CLI tool to query Kubernets, e.g. OpenShift, MicroK8s, etc. the associated tool is used to query the cluster.  Using the kubectl api-resource command, a list of all known resources can be obtained.  Using this information all K8 resources support the 'get' verb are quired using kubectl get.  The output from the get requests used to create a seperate file for each unique resource.  These files are created on the user laptop.  At this point VpK no longer communicates with the K8 instance. 

The user interface (UI), browser component, provides graphical and tabular views of resources defined and deployed in the cluster.

What is VpK? 

- VpK is designed to capture a point-in-time snapshot of the cluster.

- Vpk provides the ability to view the captured snapshot in a disconnected fashion.  Once the snapshot is created the user no longer needs to be connected to the cluster.

- Vpk will __not__ modify a K8 cluster.  It is designed as read-only.

- VpK is __not__ a realtime monitoring tool. 

- Access running K8 instances via CLI and saving results in locally stored directory.

- The locally stored K8 query results allow disconnected use of VpK once a successful retrieval of K8 resource information.
 
- Tabular viewing of resources with the abilty to filter by namespaces, kinds, labels, and resource names.

- Fully expanded or collapsible hierarchial views of K8 resources.  

- Circlepack view of K8 resouces.  

- Schematic views of running workloads in the cluster.

- Views of roles, bindings, and subject used to define RBAC.

- Usage of RBAC definitions.

- Create and view custom cross reference information of K8 resource elements.	
- Compare previously captured snapshots.  

<br><br>


### Vpk Architecture

![Architecture](https://raw.githubusercontent.com/k8debug/vpk/main/public/docs/docimages/architecture.png)


<br>

---

VpK user interface is comprised of multiple tabs. The following sections are screen captures of portions of the tabs.


### Cluster tab

Cluster view provides a 3D view of the cluster showing Nodes (master and worker), Pods (Running, Warning, Failed, Successful, DaemonSet), Network Services, Storage (PVC, PV, and Storage Class), and resource for memory, cpu, and storage.

![clusterTab](https://raw.githubusercontent.com/k8debug/vpk/main/public/images/wow/pic-cluster.png)

<br>

### Schematic tab

Kubernetes resources associated with a Pod are shown in a schematic similar to the following diagram.

![schematicTab](https://raw.githubusercontent.com/k8debug/vpk/main/public/images/wow/pic-schematic.png)

<br>

### Graphic tab

Select cluster or namespace level graphic views of defined resources in the cluster or namespace.

![graphicTab](https://raw.githubusercontent.com/k8debug/vpk/main/public/images/wow/pic-graphic.png)

<br>

### Storage tab

View defined storage resources include PersistentVolumeClaim, PersistentVolume, and StorageClass.

![storageTab](https://raw.githubusercontent.com/k8debug/vpk/main/public/images/wow/pic-storage.png)

<br>

### Security tab

RBAC definitons of Role, Subject, and RoleBinding are shown by cluster or namespace level.

![storage](https://raw.githubusercontent.com/k8debug/vpk/main/public/images/wow/pic-security.png)

<br>

### Table View tab

View all resources in the cluster and filter as desired.

![rbac](https://raw.githubusercontent.com/k8debug/vpk/main/public/images/wow/pic-tableview.png)

<br>

### OwnerRef Links tab

View ownership chains of resources in the cluster.

![rbac](https://raw.githubusercontent.com/k8debug/vpk/main/public/images/wow/pic-ownerref.png)

<br>

### Snapshot compares

Select two cluster snapshots and compare for differences.

![3DView](https://raw.githubusercontent.com/k8debug/vpk/main/public/images/wow/pic-comparesnapshots.png)

<br>

### YouTube videos on how to use VpK

To assist in understanding YouTube videos are available that discuss may of the features of the product.
Videos are sorted alpha by topic.

[https://youtu.be/8LtXugxdASY](https://youtu.be/8LtXugxdASY) - Cluster view __(out of date needs to be updated)__  
[https://youtu.be/pykzLsiAcP4](https://youtu.be/pykzLsiAcP4) - Custom X-Refs (cross references)  
[https://youtu.be/oLnhPCZa_fo](https://youtu.be/oLnhPCZa_fo) - Getting started  
[https://youtu.be/1_KdZJfKJVw](https://youtu.be/1_KdZJfKJVw) - Graphic view  
[https://youtu.be/HNzobmCYRBo](https://youtu.be/HNzobmCYRBo) - Help, Information, and Configuration  
[https://youtu.be/EqknUXaIRnk](https://youtu.be/EqknUXaIRnk) - Owner Reference links  
[https://youtu.be/10lPGzn0VCk](https://youtu.be/10lPGzn0VCk) - Schematics (viewing deployed workloads)  
[https://youtu.be/zqzGLhoS1VY](https://youtu.be/zqzGLhoS1VY) - Security view  
[https://youtu.be/7sjFh8N6FrY](https://youtu.be/7sjFh8N6FrY) - Snapshots (creating and using)  
[https://youtu.be/zgJlWk5QqBM](https://youtu.be/zgJlWk5QqBM) - Storage view  
[https://youtu.be/_YY3190mlkw](https://youtu.be/_YY3190mlkw) - Table view  
[https://youtu.be/nwm5IFHbR34](https://youtu.be/nwm5IFHbR34) - User interface basics  

<br><br>

## Contributors

Dave Weilert   
VJ Landon   
Dave Krier   




## License

Copyright (c) 2018-2022 K8Debug

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall beincluded in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
