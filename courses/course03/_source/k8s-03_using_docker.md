:course_title: K8s-03 - Using __docker__

:course_desc: During this course the student will be required to use the docker command.  <br><br>Tasks will describe a challenge.  The student will be provided example commands to aid in completing the task.  <br><br>Once complete, review the Step-by-Step instructions and be sure to press the button to mark the task complete.  <br><br>If at any time you are needing assistance press the __Hint__ button.  If you are still needing assistance use the __Step-by-Step__ button to get detailed instructions for the task. <br><br>Press the 'Begin course' button to start the course.

:course_max: 9

:button1_label: Task
:button1_color: #e6f2ff'
:button1_size: 300

:button2_label: Hint
:button2_delay: 0
:button2_color: #e6ffe6
:button2_size: 100

:button3_label: Step-by-Step
:button3_delay: 0
:button3_color: #ffe6b3
:button3_size: 500

:infotab: <hr>

:infotab: <br>No additional data.

----
----

:section_1: Task Info

<br>

View docker configuration information using the docker info command.


----

:section_2: Hint Info

<br>

Be sure to include the 'info' parameter when running the docker command.


----

:section_3: Step-by-Step Info

<br>

View docker configuration information using the docker info command.


```

Command:

	docker info
	

Example output:

	Containers: 0
	 Running: 0
	 Paused: 0
	 Stopped: 0
	Images: 0
	Server Version: 1.13.1
	Storage Driver: overlay2
	 Backing Filesystem: extfs
	 Supports d_type: true
	 Native Overlay Diff: true
	Logging Driver: journald
	Cgroup Driver: systemd
	Plugins:
	 Volume: local
	 Network: bridge host macvlan null overlay
	Swarm: inactive
	Runtimes: docker-runc runc
	Default Runtime: docker-runc
	Init Binary: /usr/libexec/docker/docker-init-current
	containerd version:  (expected: aa8187dbd3b7ad67d8e5e3a15115d3eef43a7ed1)
	runc version: 9c3c5f853ebf0ffac0d087e94daef462133b69c7 (expected: 9df8b306d01f59d3a8029be411de015b7304dd8f)
	init version: fec3683b971d9c3ef73f284f176672c44b448662 (expected: 949e6facb77383876aeff8a6944dde66b3089574)
	Security Options:
	 seccomp
	  WARNING: You're not using the default seccomp profile
	  Profile: /etc/docker/seccomp.json
	 selinux
	Kernel Version: 3.10.0-957.27.2.el7.x86_64
	Operating System: CentOS Linux 7 (Core)
	OSType: linux
	Architecture: x86_64
	Number of Docker Hooks: 3
	CPUs: 8
	Total Memory: 15.51 GiB
	Name: pysyd.159.23.66.98.nip.io
	ID: S7XU:KZ2Q:EQ2F:TP4B:MFXF:54LX:LLXH:GFFJ:JUIX:SCCM:QCU3:EWJE
	Docker Root Dir: /var/lib/docker
	Debug Mode (client): false
	Debug Mode (server): false
	Registry: https://index.docker.io/v1/
	WARNING: bridge-nf-call-iptables is disabled
	WARNING: bridge-nf-call-ip6tables is disabled
	Experimental: false
	Insecure Registries:
	 127.0.0.0/8
	Live Restore Enabled: false
	Registries: docker.io (secure)


```	

> ConfirmButton Info
	


----
----

:section_1: Task Pull

<br>

Pull docker the following docker image.

```
	ibmicpcoc/tools:latest   
```


----

:section_2: Hint Pull

<br>

Include the complete image name to ensure the proper image is pulled.


----

:section_3: Step-by-Step Pull

<br>

Pull image ibmicpcoc/tools:latest  


```

Command:

	docker pull ibmicpcoc/tools:latest



Example output:

	Trying to pull repository docker.io/ibmicpcoc/tools ...
	latest: Pulling from docker.io/ibmicpcoc/tools
	Digest: sha256:e897b6ac25ac9f220bc61e3280d835a2b46486c0228ceaf37b370e99f986d208
	Status: Image is up to date for docker.io/ibmicpcoc/tools:latest 
	

```

> ConfirmButton Pull

----
----

:section_1: Task Dockerfile

<br>

In your team home directory create a file named:

	Dockerfile      (be sure to use an uppercase letter 'D')


Copy and paste the following into the terminal session to create the file with the desired content.

```

cat > Dockerfile << EOF

FROM ibmicpcoc/tools:latest
CMD mkdir /student
WORKDIR /student
RUN echo 'Example' > file.txt
CMD ["cat", "file.txt"]

EOF

```

Be sure to press enter after pasting the content into the terminal session.

----

:section_2: Hint Dockerfile

<br>

* You and cut and paste the content into the terminal session.

* Cat the file to review the content.



----

:section_3: Step-by-Step Dockerfile

<br>

Enter the following command create the Dockerfile. 


```

-- Copy and Paste --

Command:

	cat > Dockerfile << EOF
	
	FROM ibmicpcoc/tools:latest
	CMD mkdir /student
	WORKDIR /student
	RUN echo 'Example' > file.txt
	CMD ["cat", "file.txt"]
	
	EOF	                          <<<---  Be sure to press enter after pasting content


	
Example output:
	
	[team20@pysyd ~]$            <<<--- Returns to the command prompt
	
	

Command: 

	cat Dockerfile
	
	
Example output:
	
	FROM ibmicpcoc/tools:latest
	CMD mkdir /student
	WORKDIR /student
	RUN echo 'Example' > file.txt
	CMD ["cat", "file.txt"]
	

```


> ConfirmButton Dockerfile



----

:section_1: Task Build 

<br>

Build a new docker image using the Dockerfile created in the previous step.  Use your team name for the name new docker image and 'latest' as the tag for the image.

Example command:

```
	docker build -t <team>:latest .         <<<--- replace <team> with team name
```

__Notice the ' .' blank followed by a period after name and tag.__

The period is required and tells the docker command to use the Dockerfile in the directory. 



----

:section_2: Hint Build

<br>

Include the blank followed by a period after &#60;image name&#62;:&#60;tag&#62; 


----

:section_3: Step-by-Step Build

<br>

Build a new docker image.


```

Command:

	docker build -t <team>:latest .          <<<--- replace <team> with team name
	

Example output: 

	Sending build context to Docker daemon 7.168 kB
	Step 1/5 : FROM ibmicpcoc/tools:latest
	 ---> 9aa0517519d0
	Step 2/5 : CMD mkdir /student
	 ---> Using cache
	 ---> 440a305ce1f1
	Step 3/5 : WORKDIR /student
	 ---> Using cache
	 ---> e5a510f4671e
	Step 4/5 : RUN echo 'Example' > file.txt
	 ---> Using cache
	 ---> d5489f29db28
	Step 5/5 : CMD cat file.txt
	 ---> Using cache
	 ---> c7df42e07a95
	Successfully built c7df42e07a95


```	


> ConfirmButton Build



----
----

:section_1: Task Run

<br>

Run the newly created docker image.

Example command:

```
	docker run <team>           <<<--- replace <team> with team name
```


----

:section_2: Hint Run

<br>

The run command needs the docker image name to run.


---

:section_3: Step-by-Step Run

<br>

Run the new docker image.


```

Command:

	docker run <team>              <<<--- replace <team> with team name
	
	
Example output:
	
	Example 
	

```


> ConfirmButton Run 




----
----

:section_1: Task History

<br>

Display image history and include the '--no-trunc' parameter.

Example command:

```
	docker history <team> --no-trunc       <<<--- replace <team> with team name
```


----

:section_2: Hint History

<br>

Be sure to include the '--no-trunc' parameter.


----

:section_3: Step-by-Step History

<br>

Display image history and include the '--no-trunc' parameter.


```

Command:

	docker history <team> --no-trunc        <<<--- replace <team> with team name
	
		
Example output:

	IMAGE                                                                     CREATED             CREATED BY                                                                                          SIZE                COMMENT
	sha256:c7df42e07a9543b19f7545b790aba331cdbdbb6adca3d9c580995a17d70c7045   42 minutes ago      /bin/sh -c #(nop)  CMD ["cat" "file.txt"]                                                           0 B
	sha256:d5489f29db2809cd16f5f65975ac10ef5c2de9743723234e83b0a6750a1ceb0b   42 minutes ago      /bin/sh -c echo 'Example' > file.txt                                                                8 B
	sha256:e5a510f4671e0eb592f8b146b1a74046f8e79e13d17ae861601ccbf0e36add14   42 minutes ago      /bin/sh -c #(nop) WORKDIR /student                                                                  0 B
	sha256:440a305ce1f10e0754f61783eae310f289584bc121de844fe1745cd9a2bbe00b   42 minutes ago      /bin/sh -c #(nop)  CMD ["/bin/sh" "-c" "mkdir /student"]                                            0 B
	sha256:9aa0517519d01afb7a7e72cc1b21a17dff37b58204cf2e8065396b26b161a605   5 days ago          /bin/sh -c #(nop)  CMD ["sh" "-c" "tail -f /dev/null"]                                              0 B
	<missing>                                                                 4 months ago        /bin/sh -c #(nop)  CMD ["sh"]                                                                       0 B
	<missing>                                                                 4 months ago        /bin/sh -c #(nop) ADD file:e36dd1822f36a81696170b8d664540ef4a45b846263ffc5352c49dcbd136f5f5 in /    1.2 MB


```


> ConfirmButton History




----

:section_1: Task Stats

<br>

View docker stats.

Example command:

```
	docker stats
```


----

:section_2: Hint Stats

<br>

Output will scroll, use control-C to escape and stop command.



----

:section_3: Step-by-Step Stats

<br>

View docker stats.


```

Command:
	
	docker stats
	
	
Example output:
	
	CONTAINER           CPU %               MEM USAGE / LIMIT    MEM %               NET I/O             BLOCK I/O           PIDS
	8e1efc7ddb08        0.00%               44 KiB / 15.51 GiB   0.00%               1.31 kB / 698 B     0 B / 0 B           1
	CONTAINER           CPU %               MEM USAGE / LIMIT    MEM %               NET I/O             BLOCK I/O           PIDS
	8e1efc7ddb08        0.01%               44 KiB / 15.51 GiB   0.00%               1.31 kB / 698 B     0 B / 0 B           1
	CONTAINER           CPU %               MEM USAGE / LIMIT    MEM %               NET I/O             BLOCK I/O           PIDS
	8e1efc7ddb08        0.01%               44 KiB / 15.51 GiB   0.00%               1.31 kB / 698 B     0 B / 0 B           1
	CONTAINER           CPU %               MEM USAGE / LIMIT    MEM %               NET I/O             BLOCK I/O           PIDS
	8e1efc7ddb08        0.00%               44 KiB / 15.51 GiB   0.00%               1.31 kB / 698 B     0 B / 0 B           1
	CONTAINER           CPU %               MEM USAGE / LIMIT    MEM %               NET I/O             BLOCK I/O           PIDS
	8e1efc7ddb08        0.00%               44 KiB / 15.51 GiB   0.00%               1.31 kB / 698 B     0 B / 0 B           1
	CONTAINER           CPU %               MEM USAGE / LIMIT    MEM %               NET I/O             BLOCK I/O           PIDS
	8e1efc7ddb08        0.01%               44 KiB / 15.51 GiB   0.00%               1.31 kB / 698 B     0 B / 0 B           1


. . . Use control C to stop 


```	


> ConfirmButton Stats



----
----

:section_1: Task Inspect

<br>
 
Inspect the newly created docker image.

Example command:

```
	docker inspect <team>        <<<--- replace <team> with team name
```


----

:section_2: Hint Inspect

<br>

* Output will scroll you might want to pipe output to 'more'.

* Output is JSON formatted. 


----

:section_3: Step-by-Step Inspect

<br>

Inspect the newly created docker image.


```

Command:

	docker inspect <team>        <<<--- replace <team> with team name


	
Example output:

	[
	    {
	        "Id": "sha256:c7df42e07a9543b19f7545b790aba331cdbdbb6adca3d9c580995a17d70c7045",
	        "RepoTags": [
	            "team20:latest",
	            "team20:v2"
	        ],
	        "RepoDigests": [],
	        "Parent": "sha256:d5489f29db2809cd16f5f65975ac10ef5c2de9743723234e83b0a6750a1ceb0b",
	        "Comment": "",
	        "Created": "2019-09-29T05:27:30.628514124Z",
	        "Container": "efe0885bc3d0ce14c63367848b61967fd9a6764eb3d5887287284b39e87d4d3e",
	        "ContainerConfig": {
	            "Hostname": "b23e4c5fe4fc",
	            "Domainname": "",
	            "User": "",
	            "AttachStdin": false,
	            "AttachStdout": false,
	            "AttachStderr": false,
	            "Tty": false,
	            "OpenStdin": false,
	            "StdinOnce": false,
	            "Env": [
	                "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
	            ],
	            "Cmd": [
	                "/bin/sh",
	                "-c",
	                "#(nop) ",
	                "CMD [\"cat\" \"file.txt\"]"
	            ],
	            "ArgsEscaped": true,
	            "Image": "sha256:d5489f29db2809cd16f5f65975ac10ef5c2de9743723234e83b0a6750a1ceb0b",
	            "Volumes": null,
	            "WorkingDir": "/student",
	            "Entrypoint": null,
	            "OnBuild": [],
	            "Labels": {}
	        },
	        "DockerVersion": "1.13.1",
	        "Author": "",
	        "Config": {
	            "Hostname": "b23e4c5fe4fc",
	            "Domainname": "",
	            "User": "",
	            "AttachStdin": false,
	            "AttachStdout": false,
	            "AttachStderr": false,
	            "Tty": false,
	            "OpenStdin": false,
	            "StdinOnce": false,
	            "Env": [
	                "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
	            ],
	            "Cmd": [
	                "cat",
	                "file.txt"
	            ],
	            "ArgsEscaped": true,
	            "Image": "sha256:d5489f29db2809cd16f5f65975ac10ef5c2de9743723234e83b0a6750a1ceb0b",
	            "Volumes": null,
	            "WorkingDir": "/student",
	            "Entrypoint": null,
	            "OnBuild": [],
	            "Labels": {}
	        },
	        "Architecture": "amd64",
	        "Os": "linux",
	        "Size": 1199426,
	        "VirtualSize": 1199426,
	        "GraphDriver": {
	            "Name": "overlay2",
	            "Data": {
	                "LowerDir": "/var/lib/docker/overlay2/93a7e2613dbdddd104b3758408169fdd3c59d30db48c33224eebd803ae0fcc51/diff:/var/lib/docker/overlay2/671cfbb8148a5c791fc87db0c04c792a5688301c977e3aaf5d5a868520d3b54e/diff",
	                "MergedDir": "/var/lib/docker/overlay2/bcaeeb0a6737e57253fcb91f779dcaefaf3e543896c36fc0c5f69926a7f4ded0/merged",
	                "UpperDir": "/var/lib/docker/overlay2/bcaeeb0a6737e57253fcb91f779dcaefaf3e543896c36fc0c5f69926a7f4ded0/diff",
	                "WorkDir": "/var/lib/docker/overlay2/bcaeeb0a6737e57253fcb91f779dcaefaf3e543896c36fc0c5f69926a7f4ded0/work"
	            }
	        },
	        "RootFS": {
	            "Type": "layers",
	            "Layers": [
	                "sha256:d1156b98822dccbb924b4e5fe16465a7ecac8bfc81d726177bed403a8e70c972",
	                "sha256:44011be910657cdd7911c2362e78aa01164cf17ce93bbc669742f00eda9aa806",
	                "sha256:57d096768361c1126c0b4a588f557cbe58bc7b8278c859276c402dfe3353e3be"
	            ]
	        }
	    }
	]



```


> ConfirmButton Inspect



----
----

:section_1: Task Events
 
<br>

View docker events.

Example command:

```
	docker events 
```


----
:section_2: Hint Events

<br>

* Events will only be shown when a docker event occurs.   If no events are occuring the output will be empty.

* Use the '--since' parameter to view events in the past since a specific time.

Example: 

```
	docker events --since 2019-09-29T00:29:20.250037924-05:00 
```



----

:section_3: Step-by-Step Events

<br>

Inspect the newly created docker image.


```

Command:

	docker events
	
	
Example output:


	2019-09-29T00:29:20.250037924-05:00 container create eb6ba3fcf60dee1a15c816da6fd6910fb07634903538e04ae48e8d7d51002f1c (image=team20, name=unruffled_nobel)
	2019-09-29T00:29:20.253992723-05:00 container attach eb6ba3fcf60dee1a15c816da6fd6910fb07634903538e04ae48e8d7d51002f1c (image=team20, name=unruffled_nobel)
	2019-09-29T00:29:20.319962511-05:00 network connect b10613f195540578d8ed991866dd88fdebb5bf6153633b1d5f644db2c6599c55 (container=eb6ba3fcf60dee1a15c816da6fd6910fb07634903538e04ae48e8d7d51002f1c, name=bridge, type=bridge)
	2019-09-29T00:29:20.568091911-05:00 container start eb6ba3fcf60dee1a15c816da6fd6910fb07634903538e04ae48e8d7d51002f1c (image=team20, name=unruffled_nobel)
	2019-09-29T00:29:20.619094370-05:00 container die eb6ba3fcf60dee1a15c816da6fd6910fb07634903538e04ae48e8d7d51002f1c (exitCode=0, image=team20, name=unruffled_nobel)
	2019-09-29T00:29:20.695028441-05:00 network disconnect b10613f195540578d8ed991866dd88fdebb5bf6153633b1d5f644db2c6599c55 (container=eb6ba3fcf60dee1a15c816da6fd6910fb07634903538e04ae48e8d7d51002f1c, name=bridge, type=bridge)
	
	
. . .  Control C to terminate command	
	
```


> ConfirmButton Events


----
----

